# Feature: Leaderboard UI

## Problem
Firebase integration exists for score tracking (js/leaderboard.js) but there is no in-game display. Players cannot see rankings, their own position, or high scores.

## Goal
Create a leaderboard scene accessible from the hub that displays top scores, the current player's rank, and wave/level records using the existing Firebase backend.

## Technical Context
- Engine: Phaser 3
- Backend: Firebase Realtime Database or Firestore (existing integration in `js/leaderboard.js`)
- Data available: player scores, wave records (data-only, no UI)
- Hub scene: entry point for the leaderboard

## Functional Requirements
- **FR-001**: Create a LeaderboardScene accessible via a UI button in the hub scene
- **FR-002**: Display a scrollable top-scores list (top 50) showing rank, player name, score, and highest wave reached
- **FR-003**: Highlight the current player's entry in the list with a distinct visual style
- **FR-004**: If the current player is not in the top 50, show their rank and score in a fixed footer row
- **FR-005**: Fetch leaderboard data from Firebase using the existing `js/leaderboard.js` module
- **FR-006**: Show a loading indicator while fetching data and an error message if the fetch fails
- **FR-007**: Add tab filters or toggles for different categories (all-time high score, highest wave, weekly best)
- **FR-008**: Include a back button to return to the hub scene
- **FR-009**: Cache fetched leaderboard data for the session to avoid redundant Firebase reads on repeated visits
