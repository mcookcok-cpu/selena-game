# Recon map: Subway Surfers (Android, iOS)

Scope: the core run loop only: lanes, obstacles, coins, the chase and two-hit fail state, power-ups, hoverboard, missions with the score multiplier, keys and revive.
For: the user's own game "Selena Surf" (one character, Selena Zenith), a personal project.
Date: 2026-11-08
Method: public sources only (search results, wiki pages, reviews). No APK was downloaded, decompiled or unpacked, no assets or code were taken. Screens below are inferred from written descriptions, not screenshots, so their states are medium confidence.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Wikipedia article | https://en.wikipedia.org/wiki/Subway_Surfers | developer SYBO Games, publisher Kiloo, power-up list |
| 2 | Fan wiki, Power-Ups | https://subwaysurf.fandom.com/wiki/Power-Ups | five main power-ups, six upgrade levels, +5 s per level, upgrade costs |
| 3 | TV Tropes page | https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/SubwaySurfers | continue countdown with keys, stumble then caught, thrown-with-you ending |
| 4 | GameRevolution power-up guide | https://www.gamerevolution.com/guides/56397-subway-surfers-power-ups | older guide, describes sneakers as faster run |
| 5 | TouchArcade review (2012) | https://toucharcade.com/2012/06/05/subway-surfers-review/ | jetpack flies above the tracks for coins |
| 6 | games.gg overview | https://games.gg/subway-surfers/ | lane swiping, hoverboard absorbs one crash, three missions per set raise the multiplier |
| 7 | GamesSkinny tips | https://www.gameskinny.com/?p=14842 | each completed mission raises the multiplier by one, up to 30 |
| 8 | FAQ page (weak source) | https://parkingday.org/?p=27218 | keys revive after a crash, boards have special perks; weaker source |

Search hits from "unblocked games" mirror sites were ignored.

## Core loop

Swipe between three lanes, jump and roll to dodge trains and barriers while collecting coins; one stumble is forgiven, the second catches you; power-ups and missions raise how far and how high you score.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Main menu | launch | start a run, reach everything else | play button, character, board, shop, missions, settings, currencies | default |
| S02 | Run HUD | in a run | read score and state | score, coin count, multiplier, power-up timers, mission strip, pause, hoverboard button | stumbled, power-up active, hoverboard active |
| S03 | Pause | pause button | stop a run | resume, quit, restart | paused |
| S04 | Caught / revive prompt | after the second mistake | spend a key to continue | countdown, key cost, decline | counting down, no keys |
| S05 | Results | after a run | show the run and progress | score, coins, best, mission progress, retry, menu | new best, mission done |
| S06 | Missions | menu | list the three missions of the set | mission rows, progress, multiplier | in progress, set complete |
| S07 | Characters | menu | choose a runner | grid, unlock cost | locked, owned |
| S08 | Boards | menu | choose a hoverboard and its perk | grid, perk text, upgrade | locked, owned |
| S09 | Shop | menu | buy keys, coins, power-up upgrades | tiers, price | enough, not enough |
| S10 | Settings | menu | sound, music, controls | toggles | on, off |

## Flows

```
F01 Play a run
    S01 -> S02 -> (second mistake) S04 -> S05 -> S01 or S02
    happy path taps: 1 to start, 0 to retry from results
    edge: no keys, back out mid-run, app sent to background

F02 Stumble and recover
    S02 (first hit, chaser appears) -> run clean for a few seconds -> chaser drops back
    edge: second hit during the chase ends the run

F03 Pick up and use a power-up
    S02 run through the icon -> timer chip -> expires
    edge: pick up the same one again extends it

F04 Hoverboard
    S02 activate before trouble -> next crash is absorbed -> board breaks
    edge: none left to activate

F05 Mission set
    S06 three missions -> finish all -> multiplier +1 -> new set
    edge: multiplier cap x30

F06 Revive
    S04 spend a key -> back in S02 with the track cleared
    edge: cost rises with each revive in one run (assumed, not confirmed)
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, icon | default, pressed, disabled | all |
| Currency chip | coins, keys | default | S01 S02 S05 |
| Power-up timer chip | one per power-up | counting, expiring | S02 |
| Mission row | | in progress, done | S02 S05 S06 |
| Toast | mission done, new best | | S02 |
| Countdown ring | | running | S04 |

## Inferred data model

```
Run        score, coins, distance, power-ups used, stumbles
           evidence: S05 results, mission texts
           confidence: medium
Wallet     coins, keys, hoverboards
           evidence: S04 cost in keys, S09 shop, sources 3 and 6
           confidence: high
Mission    kind, target, progress, done
           evidence: sources 6 and 7 (three per set)
           confidence: high
Progress   best score, base multiplier (1 to 30), mission set
           evidence: sources 6 and 7
           confidence: high
PowerUp    kind, duration, level (1 to 6, +5 s per level)
           evidence: source 2
           confidence: high
```

Relationships: Progress 1-n Mission (three active), Wallet shared, Run n-1 Progress.

## Feature matrix

See `features.csv`. Must: 12, should: 23, could: 12, skip: 4 (scored 43).

## Out of scope (cannot or should not be cloned)

- The Inspector, the dog, Jake and the crew, SYBO's art and music (owned by SYBO and Kiloo). The chaser here is an original design.
- Daily challenges, weekly hunts, world tour (run from their servers), leaderboards and social connect (their network).
- In-app purchases and ads.

## Conflicts between sources

- Super sneakers: the fan wiki says higher jumps, older guides say faster running. This clone follows the wiki (current).
- Hoverboard length: one low-quality page says 20 s, others say it absorbs one crash. Length not confirmed; clone uses its own value.
- Upgrade costs and the x30 cap each rest on one or two sources.

## Size

Screens 10, flows 6, entities 5. Hard parts: the two-hit chase rules, mission progress tracking across runs, train roofs and ramps (not started). Size: M for the slice built here, L with roofs, characters and world tour.
