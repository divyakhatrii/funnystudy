# Semester Project Part 2: Iteration 1 Progress Update

**App:** funnystudy (The Humor Study)
**Deployed URL:** https://funnystudy-two.vercel.app (sign in with Google). A no-sign-in preview of the feed is at https://funnystudy-two.vercel.app/demo.
**How to review:** Sign in with Google, finish the short onboarding questions, then open Study 80 from the home page. The old one-caption-at-a-time view is still available at `/study/80?view=classic` for comparison.

## User persona

Sophie is a sophomore doing the humor studies for course credit. She checks Sidechat every day to keep up with campus and see memes, and she usually scrolls on her phone while waiting in line at the dining hall or riding the subway. She's used to rating human-made versions of this exact kind of content on Sidechat, so the study should feel like that: quick to open, quick to scroll, one-handed. Before this change, she had to move through captions one screen at a time and the home page usually just said "No active studies," so she had no reason to come back.

## What the first version does

**1. Continuous, Sidechat-style caption feed (new default study view)**
- Captions now show as a vertical feed of posts instead of one caption per screen. You scroll the way you would on Sidechat, with no back and forward gestures.
- Each post has the caption text above the image, an anonymous post header, and a heart button labeled "Funny." Double-tapping a post also likes it, with a quick heart animation.
- A sticky top bar shows "x/y seen" and a thin progress bar so Sophie knows how much is left.
- More captions load automatically before you reach the bottom (batches of 200), so long studies don't stall.
- At the bottom there's an "All caught up" card with a summary ("You liked X of Y captions you saw") and the End Study button, which saves the completion and shows the same stats page as before.
- The research data still gets recorded: likes save with time-to-like, a caption counts as viewed once most of it has been on screen for about half a second, and scrolling past a caption logs a navigation event with how long it was on screen. End Study saves the same completion stats as the old flow.
- The old view still works at `?view=classic` so the two can be compared side by side for the final demo.

**2. Text notification prompt on the home page**
- If there are no active studies, the page now says "No active studies" and "Sign up for text notifications when the next one is out!" with a "Text me when it's out" button that goes straight to the phone and text-alert section of Settings.
- If there are active studies, a smaller "Get a text when the next study drops" banner sits above the list.
- People who already have text alerts on (verified phone plus the text preference turned on) see "We'll text you when the next one is out" instead of the prompt.

**How it addresses Sophie's problem:** The feed matches the scrolling habit she already has from Sidechat, so getting through a study in a dining hall line takes less effort and fewer taps. The home page prompt gives her a way to hear about the next study instead of opening the app to an empty screen.

## First PM review

**Date / format:** [DATE, in person or Zoom]
**What I showed:** [e.g. the feed on my phone, liking with the heart and double-tap, scrolling to End Study, and the empty home page with the text prompt]

**Usefulness:**
- [PM feedback]

**Clarity:**
- [PM feedback]

**Behavior:**
- [PM feedback]

## Changes planned for Iteration 2

| Change | Why (PM feedback it comes from) |
| --- | --- |
| [change] | [feedback] |
| [change] | [feedback] |
| [change] | [feedback] |

Known issues I'm already tracking:
- Text verification needs an SMS provider connected to my Supabase copy, so the Settings phone step won't send a code yet on the deployed demo. The prompt and link work, but finishing sign-up needs that provider.
- The account menu button floats at the bottom right over the feed. I may move it into the top bar so it never covers a post.
- Time-to-like is measured from when a post first appears on screen. That's not the same as the old flow, where the timer only ran for the one caption on screen. This needs to be checked with the research team.
