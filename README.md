# README

<!-- PROJECT LOGO -->
<p>
  <h2>taytay</h2>
  <p>
    taytay combines data from my favorite web applications which include Last.fm, Spotify, Genius.
    taytay helps me decide what I should dig into next. 
  </p>
</p>

<!-- TABLE OF CONTENTS -->
<details open="open">
  <summary><h2 style="display: inline-block">Table of Contents</h2></summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project
[taytay.fly.dev](https://taytay.fly.dev/)

<!-- GETTING STARTED -->
## Getting Started

To get a local copy up and running, follow these steps.

### Prerequisites

[Docker 24](https://docs.docker.com/get-docker/)
<br/>
[Docker Compose 1.29](https://docs.docker.com/compose/install/)

### Installation

1. Clone the repo
   ```sh
   git clone git@github.com:buithehoa/taytay.git
   ```
2. Build and run Docker containers by navigating to the project's root directory and executing
   ```sh
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build --remove-orphans
   ```
3. Verify if Rails app is running by visiting http://localhost:3000 in your web browser.

### Deployments

```sh
  fly deploy
```
