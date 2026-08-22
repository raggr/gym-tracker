# Gym Tracker v2

A mobile-first three-day strength tracker designed for progressive overload.

## v2 additions
- Automatic next-workout targets based on the previous working sets
- Exercise-specific load increments
- "Fill from last" button for quick gym entry
- Personal bests
- Progress chart for each exercise
- Session-volume tracking
- Full workout history
- Technique reminders
- Export/import JSON backup
- PWA manifest + offline cache
- GitHub Pages deployment workflow
- Your completed Day 1 baseline is seeded on a new browser

## Data storage
Workout records are stored in IndexedDB in the browser. GitHub Pages hosts the application files only; it does **not** receive or sync your workout history.

Use **Progress → Export JSON** periodically as a backup.

## Publish with GitHub Pages

### 1. Create an empty repository
Create a new GitHub repository, for example:

`gym-tracker`

Do not add a README, .gitignore or licence on GitHub because this folder already contains files.

### 2. Push this folder from Terminal
Open Terminal inside this folder and run:

```bash
git init
git add .
git commit -m "Gym Tracker v2"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/gym-tracker.git
git push -u origin main
```

GitHub may ask you to authenticate.

### 3. Enable Pages
On GitHub:
- Repository → **Settings**
- **Pages**
- Under **Build and deployment**, choose **GitHub Actions**

The included workflow will deploy the site. After the action completes, GitHub will show the public Pages URL.

### 4. Add to your phone home screen
Open the Pages URL on your phone.

iPhone/Safari:
- Share
- Add to Home Screen

Android/Chrome:
- Browser menu
- Install app / Add to Home screen

## Local testing

```bash
python3 -m http.server 8000
```

Then visit:

`http://localhost:8000`
