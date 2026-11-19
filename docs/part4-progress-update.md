# Semester Project Part 4: Iteration 3 Progress Update

**App:** funnystudy (The Humor Study)
**Deployed URL:** [commit-specific Vercel URL]
**How to review:** Sign in with Google and open Study 122 from the home page. Tap Start scrolling, scroll quickly to the bottom without stopping on each post, then tap the grayed-out End Study button or the "x/y seen" chip in the top right. A no-sign-in version of the feed is at `/demo` on the same URL.

## User persona

Sophie is a sophomore doing the humor studies for course credit. She checks Sidechat every day for campus news and memes, usually on her phone while waiting in line at the dining hall or riding the subway. She wants to get through a study quickly on her phone, in a feed that feels as familiar as Sidechat.

## Feedback from my last PM review

- [PM feedback, in your PM's words: e.g. the Seen/New badges were helpful, but it was hard to find the posts I skipped past when scrolling fast]
- [PM feedback: e.g. it was possible to hit End Study without seeing every caption]

## What changed in this iteration

**1. Jump to the first unseen caption**
- The "x/y seen" counter in the top right is now a button. Tapping it scrolls the feed to the first caption Sophie hasn't seen yet and briefly outlines it, so she doesn't have to hunt for the one she skipped.
- Once she has seen everything, the counter shows a check mark and takes her to the End Study card instead.
- The counter and progress bar now count liked captions as seen, so they match the Seen badge on each post.

**2. End Study stays grayed out until every caption is seen**
- At the bottom of the feed, the card now says "Almost there" with how many captions are left, and the button reads "End Study (N left)" in gray.
- If Sophie taps it anyway, it doesn't end the study. It takes her to the first caption she hasn't seen and tells her so.
- After the last caption is seen, the card changes to "You're all caught up" and End Study turns back to the normal color and works as before.

**How it addresses Sophie's problem:** Scrolling fast in a dining hall line is the whole point of the feed, but it also makes it easy to skip posts. Now she can find the ones she missed in one tap, and she can't accidentally end the study with captions unseen, which also means more complete data for the study.

**Also added for the video and demo:** adding `?view=classic` to the home page keeps the whole old flow together (old home page, old study page, no text-alert prompts), so the before and after can be shown side by side without typing separate links.

## Changes planned next

- [Next change from this PM review]
- [Next change from this PM review]

Things I'll check with my PM this time:
- Does the grayed-out End Study button feel clear, or does it read as broken?
- Is the "x/y seen" chip easy to notice as something you can tap?
