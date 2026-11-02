# Grok's 3D Physics Engine

Pure frontend 3D rigid-body physics demo that runs on **GitHub Pages** with zero build step.

## What's inside
- **Three.js** → rendering, lights, shadows, orbit controls
- **Cannon-es** → real rigid body physics (gravity, friction, restitution, collisions, sleeping)
- Click anywhere to spawn more boxes / spheres
- Everything is ES modules + CDN, so it just works

## Deploy to GitHub Pages
1. Create a new repo
2. Upload the three files (`index.html`, `main.js`, `README.md`)
3. Go to **Settings → Pages**
4. Source: Deploy from a branch → `main` / root
5. Wait ~30 seconds, open the URL

That's it. No npm, no webpack, no bullshit.

## Controls
- Left-drag → orbit camera
- Right-drag → pan
- Scroll → zoom
- Left-click empty space → spawn a random body from the sky

## Expanding it
Want joints, vehicles, constraints, soft bodies, or a proper API wrapper?  
Just yell and I'll bolt more shit on.
