# Landing hero and gameplay audio

The landing hero now leads with “Good company. A little chaos.”, a short explanation of chats, duels and Duos, and two plain actions. Its preview uses the actual Duo identity component, equipped card artwork and conversation bubbles. The two-step check-in example still supports keyboard input, replay and signup, and announces its updates. It is explicitly labelled as an interactive example; the first draft has not earned XP. The completed example shows 20 base XP toward level 2.

Desktop uses an editorial split composition, with the card artwork behind the Duo. Small screens stack the copy and preview and keep the main actions together. Both themes retain readable contrast, with a much lighter texture on the paper theme. Old hero backgrounds, their embedded-image module and approximately 600 lines of layered hero/demo CSS have been retired. The new hero has one stylesheet; the rest of the landing flow remains in LandingPage.css. The former Sparks promotion now describes the available open-table duel flow.

## Sound changes

The sound preference remains opt-in, per account and device. Ordinary text/voice check-ins and eligible friend-space messages now have a short confirmation. Duel plays have a clearer mid-frequency tap, and a completed round has a distinct win/end cue. A visible opponent also hears the result when a live round updates. Loading an old result does not play a cue.

Audio activation listens to trusted pointer-up, touch-end and keyboard gestures. An inaudible sample primes the output as well as resuming the context. Touch-end performs its own prime when pointer activation happened first. A short interruption keeps only one fresh confirmation for at most 1.2 seconds. It cannot create an audio context before activation or carry cues across mute, account switches or hidden tabs. Existing cooldowns, deduplication and immediate silence remain in place. A blocked preference write falls back to the current session; a storage event invalidates that fallback.

## Verification

- Production build, five public prerenders and all nine frontend checks pass. Lint reports zero errors; the existing configuration still reports unused-JSX and hook warnings.
- Eight new sound checks cover activation, interruption recovery, mute, account switching, visibility, expiry, storage failure, cross-tab invalidation, gain limits and duplicate events. The check is included in CI.
- Native browser audio was instrumented through real authenticated two-account games and a message/check-in against isolated Mongo. After a reload, the saved sound preference works without using the preview button. The first move deliberately suspends audio after the gesture and before the server response. Actual card plays, the winning move and the opponent’s received result schedule their cues. A mobile case requires touch-end activation and uses installed-app insets; a desktop case uses mouse input. Both complete the six-turn game, rematch and existing conversation flow without changing duel economy.
- Ten cues were rendered to PCM through OfflineAudioContext. Actual peaks range from 0.01412 to 0.02711; audible output lasts 0.129–0.444 seconds, below the 0.04 peak and 0.55-second limits. These are signal measurements, not a physical-device listening test.
- Landing interaction checks pass at 320, 390, 768, 981 and 1280 pixels in both themes. Checked signup/login controls, focus indication, hover/pressed feedback, reduced motion, demo/replay and horizontal overflow. Additional checks cover a 390px installed-app layout, 844px landscape and a short 320px viewport.

Evidence: [desktop dark](hero-audio-evidence/desktop-dark.png), [desktop light](hero-audio-evidence/desktop-light.png), [mobile](hero-audio-evidence/mobile-dark.png), [replied example](hero-audio-evidence/demo-replied.png).
