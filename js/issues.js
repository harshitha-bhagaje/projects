/**
 * GitHub Issues Manager
 * Advanced issue tracking and management for ModelEarth repositories
 */

class GitHubIssuesManager {
    constructor() {
        this.githubToken = localStorage.getItem('github_token') || '';
        this.baseURL = 'https://api.github.com';
        this.owner = 'ModelEarth'; // Default owner, can be updated
        this.perPage = 1;
        this.currentPage = 1;
        this.allIssues = [];
        this.filteredIssues = [];
        this.repositories = [];
        this.repositoryIssues = {}; // Cache for repository-specific issues
        this.assignees = new Set();
        this.labels = new Set();
        this.rateLimitInfo = {
            remaining: null,
            resetTime: null,
            startTime: null
        };
        
        // State management
        this.filters = {
            repo: 'modelearth',
            sort: 'updated',
            assignee: 'all',
            state: 'open',
            label: 'all',
            search: ''
        };
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.loadFromHash();
        this.loadFromCache();
        this.updateTokenUI();
        
        // Auto-detect owner from current URL or default to ModelEarth
        this.detectOwner();
        
        // Load rate limit info from cache
        this.loadRateLimitFromCache();
        this.startRateLimitTimer();
        
        await this.loadData();
    }

    detectOwner() {
        // Try to detect owner from URL or use default
        const hostname = window.location.hostname;
        if (hostname.includes('modelearth') || hostname.includes('model.earth')) {
            this.owner = 'ModelEarth';
        }
        // Could add more detection logic here
    }

    async loadRepositoriesFromCSV() {
        try {
            const response = await fetch('repos.csv');
            const csvText = await response.text();
            return this.parseCSV(csvText);
        } catch (error) {
            console.error('Error loading repositories from CSV:', error);
            // Fallback to hardcoded list
            return [
                {repo_name: 'modelearth', display_name: 'ModelEarth', description: 'Main ModelEarth repository', default_branch: 'master'},
                {repo_name: 'localsite', display_name: 'LocalSite', description: 'Core CSS/JS utilities', default_branch: 'main'},
                {repo_name: 'realitystream', display_name: 'RealityStream', description: 'ML Models and Visualization', default_branch: 'main'},
                {repo_name: 'feed', display_name: 'Feed', description: 'FeedPlayer video/gallery', default_branch: 'main'},
                {repo_name: 'swiper', display_name: 'Swiper', description: 'UI swiper components', default_branch: 'main'},
                {repo_name: 'comparison', display_name: 'Comparison', description: 'Trade Flow tools', default_branch: 'main'},
                {repo_name: 'codechat', display_name: 'CodeChat', description: 'Code chat interface', default_branch: 'main'},
                {repo_name: 'home', display_name: 'Home', description: 'Home page content', default_branch: 'main'},
                {repo_name: 'cloud', display_name: 'Cloud', description: 'Cloud platform tools', default_branch: 'main'},
                {repo_name: 'projects', display_name: 'Projects', description: 'Project showcases', default_branch: 'main'},
            ];
        }
    }

    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index];
            });
            data.push(row);
        }

        return data;
    }

    loadRateLimitFromCache() {
        try {
            const cached = localStorage.getItem('github_rate_limit_info');
            if (cached) {
                this.rateLimitInfo = JSON.parse(cached);
                
                // Check if rate limit period has passed
                if (this.rateLimitInfo.resetTime && new Date() > new Date(this.rateLimitInfo.resetTime)) {
                    this.clearRateLimit();
                }
            }
        } catch (error) {
            console.warn('Failed to load rate limit info from cache:', error);
        }
    }

    saveRateLimitToCache() {
        try {
            localStorage.setItem('github_rate_limit_info', JSON.stringify(this.rateLimitInfo));
        } catch (error) {
            console.warn('Failed to save rate limit info to cache:', error);
        }
    }

    clearRateLimit() {
        this.rateLimitInfo = {
            remaining: null,
            resetTime: null,
            startTime: null
        };
        localStorage.removeItem('github_rate_limit_info');
    }

    updateRateLimitDisplay() {
        const rateLimitDiv = document.getElementById('rateLimitInfo');
        if (!rateLimitDiv) return;

        if (this.rateLimitInfo.remaining !== null) {
            const resetTime = new Date(this.rateLimitInfo.resetTime);
            const now = new Date();
            const timeLeft = Math.max(0, resetTime - now);
            const minutesLeft = Math.ceil(timeLeft / 60000);

            if (timeLeft > 0) {
                rateLimitDiv.innerHTML = `
                    <div class="rate-limit-warning">
                        <i class="fas fa-clock"></i>
                        <strong>API Rate Limit:</strong> ${this.rateLimitInfo.remaining} requests remaining.
                        Resets in ${minutesLeft} minutes (${resetTime.toLocaleTimeString()})
                    </div>
                `;
                rateLimitDiv.style.display = 'block';
            } else {
                this.clearRateLimit();
                rateLimitDiv.style.display = 'none';
            }
        } else {
            rateLimitDiv.style.display = 'none';
        }
    }

    startRateLimitTimer() {
        // Update rate limit display every minute
        if (this.rateLimitTimer) {
            clearInterval(this.rateLimitTimer);
        }
        
        this.rateLimitTimer = setInterval(() => {
            this.updateRateLimitDisplay();
        }, 60000); // Update every minute
    }

    setupEventListeners() {
        // Token management
        document.getElementById('saveToken').addEventListener('click', () => this.saveToken());
        document.getElementById('clearToken').addEventListener('click', () => this.clearToken());

        // Filters
        document.getElementById('repoFilter').addEventListener('change', async (e) => {
            this.filters.repo = e.target.value;
            this.updateHash();
            this.saveToCache();
            
            // Load issues for the selected repository if not already loaded
            if (this.filters.repo !== 'all' && !this.repositoryIssues[this.filters.repo]) {
                await this.loadIssuesForRepository(this.filters.repo);
                this.updateRepositoryDropdownCounts();
            }
            
            this.filterAndDisplayIssues();
        });

        // Dropdown menus
        this.setupDropdown('sortButton', 'sortDropdown', (value) => {
            this.filters.sort = value;
            this.updateSortButton();
            this.updateHash();
            this.saveToCache();
            this.filterAndDisplayIssues();
        });

        this.setupDropdown('assigneeButton', 'assigneeDropdown', (value) => {
            this.filters.assignee = value;
            this.updateAssigneeButton();
            this.updateHash();
            this.saveToCache();
            this.filterAndDisplayIssues();
        });

        this.setupDropdown('stateButton', 'stateDropdown', (value) => {
            this.filters.state = value;
            this.updateStateButton();
            this.updateHash();
            this.saveToCache();
            this.filterAndDisplayIssues();
        });

        this.setupDropdown('labelButton', 'labelDropdown', (value) => {
            this.filters.label = value;
            this.updateLabelButton();
            this.updateHash();
            this.saveToCache();
            this.filterAndDisplayIssues();
        });

        // Search
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchButton');
        const clearSearch = document.getElementById('clearSearch');

        searchButton.addEventListener('click', () => this.performSearch());
        clearSearch.addEventListener('click', () => this.clearSearch());
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });

        // View controls
        document.getElementById('refreshButton').addEventListener('click', () => this.loadData(true));
        document.getElementById('listView').addEventListener('click', () => this.setView('list'));
        document.getElementById('cardView').addEventListener('click', () => this.setView('card'));

        // Modal
        document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
        document.getElementById('issueModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('issueModal')) this.closeModal();
        });

        // Retry button
        document.getElementById('retryButton').addEventListener('click', () => this.loadData(true));

        // Hash change listener
        window.addEventListener('hashchange', () => this.loadFromHash());
    }

    setupDropdown(buttonId, dropdownId, callback) {
        const button = document.getElementById(buttonId);
        const dropdown = document.getElementById(dropdownId);

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeAllDropdowns();
            dropdown.classList.toggle('show');
        });

        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target.classList.contains('dropdown-item')) {
                const value = e.target.getAttribute('data-sort') || 
                            e.target.getAttribute('data-assignee') || 
                            e.target.getAttribute('data-state') ||
                            e.target.getAttribute('data-label');
                callback(value);
                dropdown.classList.remove('show');
            }
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            dropdown.classList.remove('show');
        });
    }

    closeAllDropdowns() {
        document.querySelectorAll('.dropdown-menu').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }

    updateTokenUI() {
        const tokenInput = document.getElementById('githubToken');
        const clearButton = document.getElementById('clearToken');
        
        if (this.githubToken) {
            tokenInput.value = '••••••••••••••••';
            clearButton.style.display = 'inline-block';
        } else {
            tokenInput.value = '';
            clearButton.style.display = 'none';
        }
    }

    saveToken() {
        const tokenInput = document.getElementById('githubToken');
        const token = tokenInput.value.trim();
        
        if (token && token !== '••••••••••••••••') {
            this.githubToken = token;
            localStorage.setItem('github_token', token);
            localStorage.removeItem('github_issues_cache'); // Clear cache when token changes
            this.showNotification('Token saved successfully', 'success');
        }
        
        this.updateTokenUI();
    }

    clearToken() {
        this.githubToken = '';
        localStorage.removeItem('github_token');
        localStorage.removeItem('github_issues_cache'); // Clear cache when token changes
        this.updateTokenUI();
        this.showNotification('Token cleared', 'info');
    }

    async loadData(forceRefresh = false) {
        try {
            this.showLoading(true);
            this.hideError();

            // Check cache first
            if (!forceRefresh) {
                const cached = this.loadFromCache();
                if (cached && cached.repositories && cached.repositories.length > 0 && cached.issues && cached.issues.length > 0) {
                    this.repositories = cached.repositories;
                    this.allIssues = cached.issues;
                    
                    // Rebuild assignees and labels from cached data
                    this.assignees = new Set();
                    this.labels = new Set();
                    this.allIssues.forEach(issue => {
                        if (issue.assignees && issue.assignees.length > 0) {
                            issue.assignees.forEach(assignee => this.assignees.add(assignee.login));
                        }
                        if (issue.labels && issue.labels.length > 0) {
                            issue.labels.forEach(label => this.labels.add(label.name));
                        }
                    });
                    
                    console.log(`Loaded ${this.repositories.length} repositories and ${this.allIssues.length} issues from cache`);
                    this.updateUI();
                    this.showLoading(false);
                    return;
                }
            }

            this.updateLoadingStatus('Loading repositories...');
            await this.loadRepositoriesFromCSVToUI();
            
            // Load issues for default repository if specified
            if (this.filters.repo !== 'all') {
                this.updateLoadingStatus(`Loading issues for ${this.filters.repo}...`);
                await this.loadIssuesForRepository(this.filters.repo);
            }
            
            this.updateUI();
            this.saveToCache();
            this.showLoading(false);
            
        } catch (error) {
            console.error('Error loading data:', error);
            
            // Always load repositories from CSV even on API error
            try {
                await this.loadRepositoriesFromCSVToUI();
                this.showFiltersOnError();
            } catch (csvError) {
                this.showError('Failed to load repository data: ' + csvError.message);
            }
            
            this.showLoading(false);
        }
    }

    async loadRepositoriesFromCSVToUI() {
        const csvRepos = await this.loadRepositoriesFromCSV();
        
        // Convert CSV data to repository objects
        this.repositories = csvRepos.map(csvRepo => ({
            name: csvRepo.repo_name,
            displayName: csvRepo.display_name,
            description: csvRepo.description,
            defaultBranch: csvRepo.default_branch,
            openIssueCount: null, // Will be loaded on demand
            totalIssueCount: null,
            repository_url: `https://github.com/${this.owner}/${csvRepo.repo_name}`
        }));
        
        console.log(`Loaded ${this.repositories.length} repositories from CSV`);
    }

    async loadIssuesForRepository(repoName) {
        if (this.repositoryIssues[repoName]) {
            return this.repositoryIssues[repoName];
        }

        try {
            this.showNotification(`Loading issues for ${repoName}...`, 'info');
            const issues = await this.fetchRepositoryIssues(repoName);
            this.repositoryIssues[repoName] = issues;
            
            // Update the repository object with issue counts
            const repo = this.repositories.find(r => r.name === repoName);
            if (repo) {
                const openIssues = issues.filter(issue => issue.state === 'open');
                repo.openIssueCount = openIssues.length;
                repo.totalIssueCount = issues.length;
                console.log(`Repository ${repoName}: ${issues.length} total issues, ${openIssues.length} open`);
            }
            
            // Add to allIssues if not already there
            const existingIssueIds = new Set(this.allIssues.map(issue => issue.id));
            const newIssues = issues.filter(issue => !existingIssueIds.has(issue.id));
            this.allIssues.push(...newIssues);
            
            // Collect assignees and labels
            issues.forEach(issue => {
                if (issue.assignees && issue.assignees.length > 0) {
                    issue.assignees.forEach(assignee => this.assignees.add(assignee.login));
                }
                if (issue.labels && issue.labels.length > 0) {
                    issue.labels.forEach(label => this.labels.add(label.name));
                }
            });
            
            this.populateAssigneeFilter();
            this.populateLabelFilter();
            
            return issues;
        } catch (error) {
            console.error(`Failed to load issues for ${repoName}:`, error);
            this.showNotification(`Failed to load issues for ${repoName}`, 'error');
            return [];
        }
    }

    updateRepositoryDropdownCounts() {
        const select = document.getElementById('repoFilter');
        const options = select.querySelectorAll('option');
        
        options.forEach(option => {
            const repoName = option.value;
            if (repoName !== 'all') {
                const repo = this.repositories.find(r => r.name === repoName);
                if (repo && repo.openIssueCount !== null) {
                    const issueText = `(${repo.openIssueCount})`;
                    const displayName = repo.displayName || repo.name;
                    option.textContent = `${displayName} ${issueText}`;
                }
            }
        });
    }

    async enrichRepositoryData(repo) {
        try {
            // Get repository contents for file count and images
            const contents = await this.apiRequest(`/repos/${this.owner}/${repo.name}/contents`);
            repo.fileCount = contents.filter(item => item.type === 'file').length;
            
            // Look for images in common directories
            repo.images = [];
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
            
            // Check root directory
            const rootImages = contents.filter(item => 
                item.type === 'file' && 
                imageExtensions.some(ext => item.name.toLowerCase().endsWith(ext))
            );
            repo.images.push(...rootImages.slice(0, 4));
            
            // Check for common image directories if we need more images
            if (repo.images.length < 4) {
                const imageDirs = ['images', 'img', 'assets', 'static', 'public'];
                for (const dir of imageDirs) {
                    if (repo.images.length >= 4) break;
                    try {
                        const dirContents = await this.apiRequest(`/repos/${this.owner}/${repo.name}/contents/${dir}`);
                        const dirImages = dirContents.filter(item =>
                            item.type === 'file' &&
                            imageExtensions.some(ext => item.name.toLowerCase().endsWith(ext))
                        );
                        repo.images.push(...dirImages.slice(0, 4 - repo.images.length));
                    } catch (e) {
                        // Directory doesn't exist, continue
                    }
                }
            }
            
            // Get repository statistics
            const stats = await this.apiRequest(`/repos/${this.owner}/${repo.name}/stats/contributors`);
            repo.contributorCount = stats ? stats.length : 1;
            
        } catch (error) {
            console.warn(`Failed to enrich data for ${repo.name}:`, error);
            repo.fileCount = 0;
            repo.images = [];
            repo.contributorCount = 1;
        }
    }



    async fetchRepositoryIssues(repoName) {
        const issues = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            try {
                const response = await this.apiRequest(
                    `/repos/${this.owner}/${repoName}/issues?state=all&per_page=100&page=${page}`
                );
                
                if (response.length === 0) {
                    hasMore = false;
                } else {
                    // Filter out pull requests (they appear in issues endpoint)
                    const actualIssues = response.filter(issue => !issue.pull_request);
                    
                    // Enrich each issue with additional data
                    for (const issue of actualIssues) {
                        issue.repository = repoName;
                        issue.repository_url = `https://github.com/${this.owner}/${repoName}`;
                        
                        // Fetch comments if any
                        if (issue.comments > 0) {
                            try {
                                issue.comment_details = await this.apiRequest(
                                    `/repos/${this.owner}/${repoName}/issues/${issue.number}/comments`
                                );
                            } catch (e) {
                                issue.comment_details = [];
                            }
                        } else {
                            issue.comment_details = [];
                        }
                    }
                    
                    issues.push(...actualIssues);
                    page++;
                }
            } catch (error) {
                console.error(`Error fetching issues for ${repoName}, page ${page}:`, error);
                hasMore = false;
            }
        }

        console.log(`Fetched ${issues.length} issues for repository ${repoName}`);
        return issues;
    }

    async apiRequest(endpoint) {
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
        };

        if (this.githubToken) {
            headers['Authorization'] = `token ${this.githubToken}`;
        }

        const response = await fetch(`${this.baseURL}${endpoint}`, { headers });
        
        // Extract rate limit information from headers
        if (response.headers.get('X-RateLimit-Remaining')) {
            this.rateLimitInfo.remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
            this.rateLimitInfo.resetTime = new Date(parseInt(response.headers.get('X-RateLimit-Reset')) * 1000);
            this.saveRateLimitToCache();
            this.updateRateLimitDisplay();
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            // Handle rate limit exceeded
            if (response.status === 403 && errorData.message && errorData.message.includes('rate limit')) {
                this.rateLimitInfo.startTime = new Date();
                this.rateLimitInfo.remaining = 0;
                if (response.headers.get('X-RateLimit-Reset')) {
                    this.rateLimitInfo.resetTime = new Date(parseInt(response.headers.get('X-RateLimit-Reset')) * 1000);
                }
                this.saveRateLimitToCache();
                this.updateRateLimitDisplay();
            }
            
            throw new Error(`GitHub API Error: ${response.status} - ${errorData.message || response.statusText}`);
        }

        return await response.json();
    }

    updateProgress(current, total, type) {
        const percentage = Math.round((current / total) * 100);
        const progressBar = document.getElementById('progressBar');
        const loadingStatus = document.getElementById('loadingStatus');
        
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
        
        if (loadingStatus) {
            loadingStatus.textContent = `Processing ${current}/${total} ${type}...`;
        }
    }

    updateUI() {
        this.populateRepositoryFilter();
        this.populateAssigneeFilter();
        this.populateLabelFilter();
        this.updateStats();
        this.updateRateLimitDisplay();
        this.filterAndDisplayIssues();
        
        document.getElementById('filtersSection').style.display = 'block';
        document.getElementById('statsSection').style.display = 'flex';
        document.getElementById('issuesContainer').style.display = 'block';
    }

    populateRepositoryFilter() {
        const select = document.getElementById('repoFilter');
        select.innerHTML = '<option value="all">All Repositories</option>';
        
        this.repositories.forEach(repo => {
            const option = document.createElement('option');
            option.value = repo.name;
            const issueText = repo.openIssueCount !== null ? `(${repo.openIssueCount})` : '';
            option.textContent = `${repo.displayName || repo.name} ${issueText}`;
            select.appendChild(option);
        });
        
        select.value = this.filters.repo;
        
        // If modelearth repo exists in the list, make sure it's selected
        const modelEarthOption = Array.from(select.options).find(option => option.value === 'modelearth');
        if (modelEarthOption && this.filters.repo === 'modelearth') {
            select.value = 'modelearth';
        }
    }

    populateAssigneeFilter() {
        const dropdown = document.getElementById('assigneeDropdown');
        
        // Keep existing default options
        const defaultOptions = dropdown.innerHTML;
        dropdown.innerHTML = defaultOptions;
        
        // Add assignees
        Array.from(this.assignees).sort().forEach(assignee => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.setAttribute('data-assignee', assignee);
            item.innerHTML = `<i class="fas fa-user"></i> ${assignee}`;
            dropdown.appendChild(item);
        });
    }

    populateLabelFilter() {
        const dropdown = document.getElementById('labelDropdown');
        
        // Keep existing default options
        const defaultOptions = dropdown.innerHTML;
        dropdown.innerHTML = defaultOptions;
        
        // Add labels
        Array.from(this.labels).sort().forEach(label => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.setAttribute('data-label', label);
            item.innerHTML = `<i class="fas fa-tag"></i> ${label}`;
            dropdown.appendChild(item);
        });
    }

    updateStats() {
        const totalRepos = this.repositories.length;
        const openIssues = this.allIssues.filter(issue => issue.state === 'open').length;
        const closedIssues = this.allIssues.filter(issue => issue.state === 'closed').length;
        const totalComments = this.allIssues.reduce((sum, issue) => sum + (issue.comments || 0), 0);

        document.getElementById('repoCount').textContent = totalRepos;
        document.getElementById('openIssueCount').textContent = openIssues;
        document.getElementById('closedIssueCount').textContent = closedIssues;
        document.getElementById('totalComments').textContent = totalComments;
    }

    filterAndDisplayIssues() {
        console.log(`Filtering ${this.allIssues.length} total issues with filters:`, this.filters);
        this.filteredIssues = this.allIssues.filter(issue => {
            // Repository filter
            if (this.filters.repo !== 'all' && issue.repository !== this.filters.repo) {
                return false;
            }

            // State filter
            if (this.filters.state !== 'all' && issue.state !== this.filters.state) {
                return false;
            }

            // Assignee filter
            if (this.filters.assignee !== 'all') {
                if (this.filters.assignee === 'unassigned') {
                    if (issue.assignees && issue.assignees.length > 0) return false;
                } else {
                    if (!issue.assignees || !issue.assignees.some(a => a.login === this.filters.assignee)) {
                        return false;
                    }
                }
            }

            // Label filter
            if (this.filters.label !== 'all') {
                if (!issue.labels || !issue.labels.some(l => l.name === this.filters.label)) {
                    return false;
                }
            }

            // Search filter
            if (this.filters.search) {
                const searchTerm = this.filters.search.toLowerCase();
                const searchableText = [
                    issue.title,
                    issue.body || '',
                    issue.number.toString(),
                    ...(issue.labels || []).map(l => l.name)
                ].join(' ').toLowerCase();
                
                if (!searchableText.includes(searchTerm)) {
                    return false;
                }
            }

            return true;
        });

        console.log(`After filtering: ${this.filteredIssues.length} issues match the filters`);
        this.sortIssues();
        this.displayIssues();
    }

    sortIssues() {
        this.filteredIssues.sort((a, b) => {
            switch (this.filters.sort) {
                case 'created':
                    return new Date(b.created_at) - new Date(a.created_at);
                case 'comments':
                    return (b.comments || 0) - (a.comments || 0);
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'number':
                    return b.number - a.number;
                case 'updated':
                default:
                    return new Date(b.updated_at) - new Date(a.updated_at);
            }
        });
    }

    displayIssues() {
        const issuesList = document.getElementById('issuesList');
        const startIndex = (this.currentPage - 1) * this.perPage;
        const endIndex = startIndex + this.perPage;
        const pageIssues = this.filteredIssues.slice(startIndex, endIndex);

        issuesList.innerHTML = '';

        if (pageIssues.length === 0) {
            issuesList.innerHTML = `
                <div class="no-issues">
                    <i class="fas fa-search"></i>
                    <h3>No issues found</h3>
                    <p>Try adjusting your filters or search terms.</p>
                </div>
            `;
        } else {
            pageIssues.forEach(issue => {
                const issueElement = this.createIssueElement(issue);
                issuesList.appendChild(issueElement);
            });
        }

        this.updatePagination();
    }

    createIssueElement(issue) {
        const issueDiv = document.createElement('div');
        issueDiv.className = 'issue-item';
        issueDiv.setAttribute('data-issue-id', issue.id);

        const stateIcon = issue.state === 'open' ? 
            '<i class="fas fa-exclamation-circle issue-open"></i>' : 
            '<i class="fas fa-check-circle issue-closed"></i>';

        const assigneesHtml = issue.assignees && issue.assignees.length > 0 ? 
            issue.assignees.map(assignee => `
                <img src="${assignee.avatar_url}" alt="${assignee.login}" class="assignee-avatar" title="${assignee.login}">
            `).join('') : '';

        const labelsHtml = issue.labels && issue.labels.length > 0 ? 
            issue.labels.map(label => `
                <span class="issue-label" style="background-color: #${label.color}; color: ${this.getContrastColor(label.color)}">
                    ${label.name}
                </span>
            `).join('') : '';

        const repoInfo = this.repositories.find(r => r.name === issue.repository) || {};
        const repoImages = repoInfo.images && repoInfo.images.length > 0 ? `
            <div class="repo-images">
                ${repoInfo.images.slice(0, 2).map(img => `
                    <img src="${img.download_url}" alt="${img.name}" class="repo-image">
                `).join('')}
            </div>
        ` : '';

        issueDiv.innerHTML = `
            <div class="issue-header">
                <div class="issue-title-row">
                    ${stateIcon}
                    <h3 class="issue-title">
                        <a href="${issue.html_url}" target="_blank">${this.escapeHtml(issue.title)}</a>
                    </h3>
                    <div class="issue-number">#${issue.number}</div>
                </div>
                <div class="issue-meta">
                    <span class="repo-name">
                        <i class="fas fa-code-branch"></i>
                        <a href="${issue.repository_url}" target="_blank">${issue.repository}</a>
                    </span>
                    <span class="issue-date">
                        <i class="fas fa-clock"></i>
                        Updated ${this.formatDate(issue.updated_at)}
                    </span>
                    ${issue.comments > 0 ? `
                        <span class="comment-count">
                            <i class="fas fa-comments"></i>
                            ${issue.comments}
                        </span>
                    ` : ''}
                </div>
            </div>

            <div class="issue-body">
                ${issue.body ? `
                    <div class="issue-description">
                        ${this.formatMarkdown(issue.body.substring(0, 300))}
                        ${issue.body.length > 300 ? '...' : ''}
                    </div>
                ` : ''}
                
                ${labelsHtml ? `<div class="issue-labels">${labelsHtml}</div>` : ''}
                
                <div class="issue-footer">
                    <div class="issue-author">
                        <img src="${issue.user.avatar_url}" alt="${issue.user.login}" class="author-avatar">
                        <span>by ${issue.user.login}</span>
                    </div>
                    
                    ${assigneesHtml ? `<div class="issue-assignees">${assigneesHtml}</div>` : ''}
                    
                    <div class="issue-actions">
                        <button class="btn btn-sm btn-outline" onclick="issuesManager.showIssueDetails(${issue.id})">
                            <i class="fas fa-eye"></i> Details
                        </button>
                        <a href="${issue.html_url}" target="_blank" class="btn btn-sm btn-outline">
                            <i class="fab fa-github"></i> GitHub
                        </a>
                    </div>
                </div>
                
                ${repoImages}
            </div>
        `;

        return issueDiv;
    }

    async showIssueDetails(issueId) {
        const issue = this.allIssues.find(i => i.id === issueId);
        if (!issue) return;

        const modal = document.getElementById('issueModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        modalTitle.textContent = `${issue.title} #${issue.number}`;

        // Create detailed view
        const stateIcon = issue.state === 'open' ? 
            '<i class="fas fa-exclamation-circle issue-open"></i>' : 
            '<i class="fas fa-check-circle issue-closed"></i>';

        const assigneesHtml = issue.assignees && issue.assignees.length > 0 ? 
            issue.assignees.map(assignee => `
                <div class="assignee-detail">
                    <img src="${assignee.avatar_url}" alt="${assignee.login}" class="assignee-avatar">
                    <span>${assignee.login}</span>
                </div>
            `).join('') : '<span class="text-muted">No assignees</span>';

        const labelsHtml = issue.labels && issue.labels.length > 0 ? 
            issue.labels.map(label => `
                <span class="issue-label" style="background-color: #${label.color}; color: ${this.getContrastColor(label.color)}">
                    ${label.name}
                </span>
            `).join('') : '<span class="text-muted">No labels</span>';

        const commentsHtml = issue.comment_details && issue.comment_details.length > 0 ? 
            issue.comment_details.map(comment => `
                <div class="comment-item">
                    <div class="comment-header">
                        <img src="${comment.user.avatar_url}" alt="${comment.user.login}" class="comment-avatar">
                        <strong>${comment.user.login}</strong>
                        <span class="comment-date">${this.formatDate(comment.created_at)}</span>
                    </div>
                    <div class="comment-body">
                        ${this.formatMarkdown(comment.body)}
                    </div>
                </div>
            `).join('') : '<p class="text-muted">No comments</p>';

        modalBody.innerHTML = `
            <div class="issue-detail">
                <div class="issue-header-detail">
                    ${stateIcon}
                    <div class="issue-meta-detail">
                        <div class="repo-info">
                            <i class="fas fa-code-branch"></i>
                            <a href="${issue.repository_url}" target="_blank">${issue.repository}</a>
                        </div>
                        <div class="issue-dates">
                            <div><i class="fas fa-plus"></i> Created: ${this.formatDate(issue.created_at)}</div>
                            <div><i class="fas fa-clock"></i> Updated: ${this.formatDate(issue.updated_at)}</div>
                        </div>
                    </div>
                </div>

                <div class="issue-section">
                    <h4>Description</h4>
                    <div class="issue-description-full">
                        ${issue.body ? this.formatMarkdown(issue.body) : '<span class="text-muted">No description provided</span>'}
                    </div>
                </div>

                <div class="issue-section">
                    <h4>Labels</h4>
                    <div class="issue-labels-detail">
                        ${labelsHtml}
                    </div>
                </div>

                <div class="issue-section">
                    <h4>Assignees</h4>
                    <div class="assignees-detail">
                        ${assigneesHtml}
                    </div>
                </div>

                <div class="issue-section">
                    <h4>Comments (${issue.comments || 0})</h4>
                    <div class="comments-section">
                        ${commentsHtml}
                    </div>
                </div>

                <div class="issue-actions-detail">
                    <a href="${issue.html_url}" target="_blank" class="btn btn-primary">
                        <i class="fab fa-github"></i> View on GitHub
                    </a>
                    <a href="${issue.html_url}/edit" target="_blank" class="btn btn-secondary">
                        <i class="fas fa-edit"></i> Edit Issue
                    </a>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    closeModal() {
        document.getElementById('issueModal').style.display = 'none';
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredIssues.length / this.perPage);
        const startIndex = (this.currentPage - 1) * this.perPage;
        const endIndex = Math.min(startIndex + this.perPage, this.filteredIssues.length);

        // Update pagination info
        document.getElementById('paginationInfo').textContent = 
            `Showing ${startIndex + 1}-${endIndex} of ${this.filteredIssues.length} issues (${this.perPage} per page)`;

        // Update pagination controls
        const paginationControls = document.getElementById('paginationControls');
        paginationControls.innerHTML = '';

        if (totalPages <= 1) return;

        // Previous button
        const prevButton = document.createElement('button');
        prevButton.className = `pagination-btn ${this.currentPage === 1 ? 'disabled' : ''}`;
        prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevButton.onclick = () => this.goToPage(this.currentPage - 1);
        paginationControls.appendChild(prevButton);

        // Page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = `pagination-btn ${i === this.currentPage ? 'active' : ''}`;
            pageButton.textContent = i;
            pageButton.onclick = () => this.goToPage(i);
            paginationControls.appendChild(pageButton);
        }

        // Next button
        const nextButton = document.createElement('button');
        nextButton.className = `pagination-btn ${this.currentPage === totalPages ? 'disabled' : ''}`;
        nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextButton.onclick = () => this.goToPage(this.currentPage + 1);
        paginationControls.appendChild(nextButton);
    }

    goToPage(page) {
        const totalPages = Math.ceil(this.filteredIssues.length / this.perPage);
        if (page < 1 || page > totalPages) return;
        
        this.currentPage = page;
        this.displayIssues();
        
        // Scroll to top of issues
        document.getElementById('issuesContainer').scrollIntoView({ behavior: 'smooth' });
    }

    // Utility methods
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'today';
        if (diffDays === 1) return 'yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        
        return date.toLocaleDateString();
    }

    formatMarkdown(text) {
        // Basic markdown formatting
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getContrastColor(hexColor) {
        // Convert hex to RGB
        const r = parseInt(hexColor.substr(0, 2), 16);
        const g = parseInt(hexColor.substr(2, 2), 16);
        const b = parseInt(hexColor.substr(4, 2), 16);
        
        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    // State management
    updateHash() {
        const params = new URLSearchParams();
        Object.entries(this.filters).forEach(([key, value]) => {
            if (value && value !== 'all' && value !== '') {
                params.set(key, value);
            }
        });
        
        const hash = params.toString() ? `#${params.toString()}` : '';
        window.history.replaceState(null, null, window.location.pathname + hash);
    }

    loadFromHash() {
        const hash = window.location.hash.substring(1);
        if (!hash) return;

        const params = new URLSearchParams(hash);
        params.forEach((value, key) => {
            if (this.filters.hasOwnProperty(key)) {
                this.filters[key] = value;
            }
        });

        this.updateFilterUI();
    }

    updateFilterUI() {
        // Update filter dropdowns and inputs
        document.getElementById('repoFilter').value = this.filters.repo;
        document.getElementById('searchInput').value = this.filters.search;
        
        this.updateSortButton();
        this.updateAssigneeButton();
        this.updateStateButton();
        this.updateLabelButton();
        
        if (this.filters.search) {
            document.getElementById('clearSearch').style.display = 'inline-block';
        }
    }

    updateSortButton() {
        const button = document.getElementById('sortButton');
        const sortNames = {
            updated: 'Updated',
            created: 'Created',
            comments: 'Comments',
            title: 'Title',
            number: 'Number'
        };
        button.innerHTML = `
            <i class="fas fa-sort"></i> Sort by: ${sortNames[this.filters.sort]}
            <i class="fas fa-chevron-down"></i>
        `;
    }

    updateAssigneeButton() {
        const button = document.getElementById('assigneeButton');
        let displayText = 'All';
        if (this.filters.assignee === 'unassigned') {
            displayText = 'Unassigned';
        } else if (this.filters.assignee !== 'all') {
            displayText = this.filters.assignee;
        }
        button.innerHTML = `
            <i class="fas fa-user"></i> Assigned to: ${displayText}
            <i class="fas fa-chevron-down"></i>
        `;
    }

    updateStateButton() {
        const button = document.getElementById('stateButton');
        const stateNames = {
            open: 'Open',
            closed: 'Closed',
            all: 'All'
        };
        button.innerHTML = `
            <i class="fas fa-exclamation-circle"></i> State: ${stateNames[this.filters.state]}
            <i class="fas fa-chevron-down"></i>
        `;
    }

    updateLabelButton() {
        const button = document.getElementById('labelButton');
        let displayText = this.filters.label === 'all' ? 'All' : this.filters.label;
        button.innerHTML = `
            <i class="fas fa-tags"></i> Labels: ${displayText}
            <i class="fas fa-chevron-down"></i>
        `;
    }

    saveToCache() {
        const cacheData = {
            filters: this.filters,
            repositories: this.repositories,
            issues: this.allIssues,
            timestamp: Date.now()
        };
        localStorage.setItem('github_issues_cache', JSON.stringify(cacheData));
    }

    loadFromCache() {
        try {
            const cached = localStorage.getItem('github_issues_cache');
            if (!cached) return null;

            const data = JSON.parse(cached);
            
            // Check if cache is less than 5 minutes old
            const maxAge = 5 * 60 * 1000; // 5 minutes
            if (Date.now() - data.timestamp > maxAge) {
                return null;
            }

            if (data.filters) {
                this.filters = { ...this.filters, ...data.filters };
            }

            return data;
        } catch (error) {
            console.warn('Failed to load from cache:', error);
            return null;
        }
    }

    // Search functionality
    performSearch() {
        const searchInput = document.getElementById('searchInput');
        this.filters.search = searchInput.value.trim();
        this.currentPage = 1;
        this.updateHash();
        this.saveToCache();
        this.filterAndDisplayIssues();
        
        if (this.filters.search) {
            document.getElementById('clearSearch').style.display = 'inline-block';
        }
    }

    clearSearch() {
        document.getElementById('searchInput').value = '';
        document.getElementById('clearSearch').style.display = 'none';
        this.filters.search = '';
        this.currentPage = 1;
        this.updateHash();
        this.saveToCache();
        this.filterAndDisplayIssues();
    }

    // View management
    setView(viewType) {
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(viewType + 'View').classList.add('active');
        
        const issuesList = document.getElementById('issuesList');
        issuesList.className = `issues-list ${viewType}-view`;
    }

    // UI helpers
    showLoading(show) {
        document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
        if (show) {
            document.getElementById('progressBar').style.width = '0%';
        }
    }

    updateLoadingStatus(status) {
        document.getElementById('loadingStatus').textContent = status;
    }

    showError(message) {
        document.getElementById('errorMessage').style.display = 'block';
        document.getElementById('errorText').textContent = message;
        document.getElementById('filtersSection').style.display = 'none';
        document.getElementById('statsSection').style.display = 'none';
        document.getElementById('issuesContainer').style.display = 'none';
    }

    hideError() {
        document.getElementById('errorMessage').style.display = 'none';
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        const iconMap = {
            'success': 'check',
            'error': 'exclamation-triangle',
            'info': 'info'
        };
        const icon = iconMap[type] || 'info';
        
        notification.innerHTML = `
            <i class="fas fa-${icon}-circle"></i>
            ${message}
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Show and auto-hide
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    showFiltersOnError() {
        // Show basic UI elements even when API fails
        document.getElementById('filtersSection').style.display = 'block';
        
        // Populate repository filter from loaded repositories
        this.populateRepositoryFilter();
        
        // Update rate limit display
        this.updateRateLimitDisplay();
        
        // Set basic stats
        document.getElementById('repoCount').textContent = '1';
        document.getElementById('openIssueCount').textContent = '?';
        document.getElementById('closedIssueCount').textContent = '?';
        document.getElementById('totalComments').textContent = '?';
        
        // Show stats section
        document.getElementById('statsSection').style.display = 'flex';
        
        // Show issues container with message
        document.getElementById('issuesContainer').style.display = 'block';
        document.getElementById('issuesList').innerHTML = `
            <div class="no-issues">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>API Rate Limit Exceeded</h3>
                <p>GitHub API rate limit reached. Please try again later or add a GitHub token to increase your rate limit.</p>
                <p>You can still use the filters - they will work once the API is accessible again.</p>
            </div>
        `;
        
        // Hide pagination
        document.getElementById('paginationContainer').innerHTML = '';
    }
}

// Initialize the issues manager when the page loads
let issuesManager;
document.addEventListener('DOMContentLoaded', () => {
    issuesManager = new GitHubIssuesManager();
});