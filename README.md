# Nhan Nguyen portfolio

A funny full-stackoverflow side project to make Nhan Nguyen portfolio.

In this project, I research the GitHub API and how to display a markdown file from GitHub on my frontend website for the purpose of showcasing blog or project details.

This project services is hosted in [Render](https://render.com/)

<!---toc start-->

* [Nhan Nguyen portfolio](#nhan-nguyen-portfolio)
  * [Techstack](#techstack)
    * [Frontend:](#frontend)
    * [Backend:](#backend)
  * [Installation](#installation)
  * [Usage](#usage)

<!---toc end-->

## Techstack
### Frontend:
- React-ts
- MUI

### Backend:
- Express
- GithubAPI

## Installation

1. Clone the repository.

   ```sh
   git clone https://github.com/nguyen-tri-nhan/portfolio.git
   ```

2. Install the dependencies.

    For webapp

    ```sh
    cd webapp
    yarn
    ```

    For service

    ```sh
    cd services
    yarn
    ```

## Usage

1. Run the application.

    Create `.env` file in `/webapp`

    In webapp:

    ```.env
    VITE_API_URL=http://localhost:3001
    ```

    Create `.env` file in `/services`

    In webapp:

    ```.env
    GITHUB_TOKEN=<YOUR_TOKEN>
    GITHUB_USERNAME=<YOUR_USERNAME>
    GITHUB_REPO=<YOUR_CONTENT_REPO>
    GITHUB_BRANCH=master
    CORS_ORIGIN=http://localhost:3000
    ```

2. Open your browser and navigate to `http://localhost:3000`.

3. Create content repo with this tree.

    ```.env
    Root/
    ├─ [category]/
    │  ├─ post.md
    ├─ images/
    │  ├─ default.png
    │  ├─ [category]/
    │  │  ├─ [post].md/
    │  │  │  ├─ [img].png

    ```
