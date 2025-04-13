# Building Branches Locally

## Important: To avoid failed "Actions" when contributing

**1. Use ModelEarthBranch**: Work in the [ModelEarthBranch](https://github.com/DataScape/projects/tree/ModelEarthBranch) when introducing new features.  
Avoid editing the main branch to avoid a `build_release` error in the [Actions tab](https://github.com/ModelEarth/projects/actions) - [our cleaner Actions tab](https://github.com/datascape/open-webui/actions).  
We change the "version" number in package.json (and package-lock.json ?) whenever we add to the main branch.

**2. Frontend Formatting**:

A. Before pushing changes to the frontend code, run to ensure proper formatting:

    npm run format
    npm run i18n:parse

B. Add your own tests in the `cypress/e2e/` folder and start the server.  
Run the following to execute the test suites. Ensure all tests pass without errors.

    npx cypress run

<b><span style="color:red">Don't use</span></b> `npm run dev` it only hosts the frontend and you'll get a message that the backend did not build. 

**3. Backend Formatting**:
For any backend changes, run to maintain code formatting.  
Add any necessary tests to ensure your code changes are covered.

    npm run format:backend

**4. Pull Requests Merging**:
After creating a pull request, fill in the template and wait for all workflows to execute.  
Address any issues if a workflow fails before merging into the main branch.

Note: We removed Ollama and chat.cy.ts in the actions. [changelog](https://github.com/datascape/open-webui/blob/gha-test/.github/CHANGELOG-workflow.md).
