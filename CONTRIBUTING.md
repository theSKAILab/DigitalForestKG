# Contributing to the DigitalForest Web App

First off, thank you for considering contributing! We use either a branch-develop-PR or fork-develop-PR workflow depending on your relation to the project.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Ways to Contribute](#ways-to-contribute)
4. [Development Workflow](#tech-stack-and-development-workflow)
5. [Coding Standards](#coding-standards)
6. [Submitting a Pull Request](#submitting-a-pull-request)

------

## 1. Code of Conduct

As a publicly funded university project, you are responsible for complying with all applicable standards, laws, and regulations that apply to NSF funded-projects at public institutions in the United States. Please be respectful and inclusive in all interactions.

## 2. Getting Started

### Prerequisites

- **Git 2.23+**
- **Python 3.13+** (Some older versions may work as well.)
- **pip** (Python package installer)
- **venv** (Python virtual environment module)

### Local Development Setup

Follow these steps to get your development environment running:

1. **Clone** the repository.

2. **Create a Virtual Environment**:

   ```bash
   python -m venv venv
   ```

3. **Activate the Environment**:

   - Windows: `venv\Scripts\activate`
   - macOS/Linux: `source venv/bin/activate`

4. **Install Dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

5. **Run the Application**:

   ```bash
   export FLASK_APP=app.py
   export FLASK_ENV=development
   export FLASK_TEMPLATES=templates
   flask run
   ```
   
   **NOTE:** to access the WIP templates, change 
   ```bash
   export FLASK_TEMPLATES=templates
   ```
   to
   ```bash
   export FLASK_TEMPLATES=templates_dev
   ```

   *The app should now be visible at `http://127.0.0.1:5000`.*


------

## 3. Ways to Contribute

- Participate in a user experience interview
- Request features (File an issue with `Feature Request` tag)
- Find and file bugs/issues
- Fix bugs/Develop features (See sections 4-6 for details)
- Develop tests and SPARQL queries

## 4. Tech Stack and Development Workflow

#### For consultant and external contributors, we follow a standard "Fork-and-Pull" workflow.

1. **Fork the Repository**: Remember to create an upstream remote, so you can pull changes from upstream/main. *Tip: name your remote forked repository* `origin` *and the upstream remote* `upstream` *to keep things as simple and clear as possible.*
2. **Develop**: Develop as you see fit, but consider the following internal workflow as a possible model for your development.
3. Create a pull request (PR). **Keep it Small**: Pull Requests **must** be focused on a single change. 
   **Pull request that conflate issues or address more than one feature or bug fix will be rejected**.

#### For internal contributors, we use a standard branch-and-pull workflow.

1. **Find an Issue**: Look for issues labeled `good first issue`.

2. **Create a Branch & Switch to It**: `git switch -c your-branch-name`or (if using older git) `git checkout -b your-branch-name`.

3. **Develop**. Make the changes you need to for your fix or feature. Remember to test the results.

4. **Stage Changes & Commit**: Use `git status` to see what's changed and unstaged. Stage any unstaged files needed for the commit and *only* those needed for the commit. Do not use `git add *`, `git add .`, or `git add --all`. Your fix or feature should be small enough it is easy to explicitly stage changes. 

   Commit changes with `git commit -m "Your descriptive commit message"`.

5. Keep updated by **Rebasing** your branch onto origin/main. `git rebase origin/main`

6. **Push to Remote**: `git push origin your-branch-name`.

7. Create a pull request (PR). **Keep it Small**: Pull Requests **must** be focused on a single change. 
   **Pull request that conflate issues or address more than one feature or bug fix will be rejected**.

### Working with Flask & Bootstrap

- **Templates**: All HTML files are located in `/templates`. We use Jinja2 templating.
- **Static Assets**: Custom CSS or JavaScript should be placed in `/static/content`(for CSS) or `/static/scripts` (for JavaScript). Please do not modify the core 3rd-party files directly; for Bootstrap use an external stylesheet to override styles. 
  **Pull request that modify standard 3rd-party static assets or frameworks will be rejected**
- Standard 3rd-party static assets, include:
  - Bootstrap
  - JQuery (& plugins)
  - Modernizr
  - Respond.js

------

## 5. Coding Standards

### Python

We are working on our own style guide, until then follow [**PEP 8** style guidelines](https://peps.python.org/pep-0008/). 

### HTML/Bootstrap

- Use meaningful class names.
- Ensure all images have `alt` tags for accessibility.
- Utilize Bootstrap's grid system (`container`, `row`, `col`) rather than hard-coded pixel widths.

------

## 6. Submitting a Pull Request

1. **Update Documentation**: If you changed how an interface works or added a feature, update any associated documentation.
2. **Test Your Changes**: You may need to write a test, but you can open an issue requesting someone test your changes (this will take longer).
3. **Submit**: If changes pass testing, open the PR against the `main` branch.
4. **Review**: At least one maintainer will review your code. Be prepared to make adjustments based on feedback!

----

#### Things that will get your PR rejected.

<span style="color:red; font-weight:bold;">Important!</span> 
PR with any of the following issues will be rejected with little or no feedback:

- Focuses on more than one fix or feature

- Includes files unrelated to the changes 

- Includes an excessive number of extraneous changes (e.g., unnecessarily updating all references to `https://host.domain.tld` to `https://host.domain.tld/`across 200+ files)

- Modifies any 3rd-party standard library or framework used

- Introduces suspicious or malicious code

  ----
  
  
