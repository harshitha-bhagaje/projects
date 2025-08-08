# Repository Configuration Changes

## Overview

The ModelEarth GitHub issues system has been expanded to include additional repositories for comprehensive issue tracking.

## Changes Made

### 1. Repository List Expansion

**Original repositories (12):** 
- modelearth, localsite, realitystream, feed, swiper, comparison, codechat, home, cloud, projects, browser-extension, embed

**Removed repositories (2):**
- browser-extension, embed

**Additional repositories added (23):**
- team - Rust REST API for Azure
- MaterialScience - MaterialScience webroot  
- products - Products frontend and python
- products-data - Products data output
- profile - Profile frontend analysis
- exiobase - Trade flow output to .csv and SQL
- io - Input-output analysis
- useeio.js - JavaScript footprint tools (updated name: USEEIO.JS)
- useeio-widgets - USEEIO React widgets
- useeio-widgets-without-react - USEEIO widgets without React
- useeiopy - Python USEEIO library
- useeio_api - USEEIO REST API
- useeio - Core USEEIO model
- useeior - R package for USEEIO
- useeio-state - State-level USEEIO data
- useeio-json - USEEIO JSON data
- mario - Multi-regional input-output
- webroot - PartnerTools webroot
- data-pipeline - Python data processing pipeline
- community-data - Community-level data outputs
- community-timelines - Timeline data for communities
- community-zipcodes - ZIP code level community data
- community-forecasting - Forecasting frontend
- dataflow - Data flow NextJS UX

**Total repositories now: 33**

### 2. Files Modified

- `repos.csv` - Updated with additional repositories
- `js/issues.js` - Updated hardcoded fallback list to match CSV

## Impact

- **Issue Tracking**: Now tracks issues from 33 repositories instead of 12
- **Dropdown Menu**: Repository filter now shows all 33 repositories with issue counts
- **API Efficiency**: System will cache issue data for all repositories
- **Fallback Safety**: Even if CSV fails to load, all repositories are included in hardcoded fallback
- **USEEIO Ecosystem**: Comprehensive coverage of all USEEIO-related repositories (9 repos)
- **Community Data**: Full tracking of community-level data and analysis tools (4 repos)

## Technical Details

### CSV Structure
Each repository entry contains:
- `repo_name` - GitHub repository name
- `display_name` - Human-readable name for UI
- `description` - Brief description of repository purpose
- `default_branch` - Main branch (usually 'main', 'master', or 'dev')

### Loading Process
1. System attempts to load `repos.csv`
2. If CSV fails, uses hardcoded fallback list in `issues.js`
3. If GitHub token available, may also load additional repositories via API

### Compatibility
- Maintains backward compatibility
- No breaking changes to existing functionality

## Maintenance

To add more repositories in the future:
1. Edit `repos.csv` to add new entries
2. Update hardcoded fallback list in `issues.js`

To remove repositories:
1. Remove entries from `repos.csv`
2. Update hardcoded fallback list in `issues.js`