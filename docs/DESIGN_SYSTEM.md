# Design system

Version 0.4.0. Tokens live in `src/styles/abidora.css` (`:root`).

## Tokens
`--ink --ink2 --bone --bone2 --mute --line --signal`, `--serif --sans --mono`, `--gx` (page gutter, at least 20 px plus safe area).

## Layout
- Full-bleed sections, gutter `--gx`, hairline dividers (`--line`).
- Editorial two-column sections: mono label on the left (sticky on desktop), content on the right; one column under 800 px.
- Section labels numbered `(01)` … in mono.

## Components
| Component | Where | Notes |
|---|---|---|
| Bar | every page | wordmark, centre nav, language menu, contact, mobile menu with focus trap |
| Language menu / panel | every page | 10 languages, remembers choice |
| Cursor lens / dot | fine pointers only | Studio setting |
| Reveal `.rv` | home | fade + rise when scrolled into view |
| Portrait | home, founder | AVIF/WebP/JPG, fixed ratio 1144:1720, clip-path reveal, parallax |
| Interest list `.it` | founder | open ring = area of exploration |
| Project plate `.pj` | founder | solid plate = real project |
| Note `.fnote2` | founder | dashed = interests, solid = actual work |
| Chips | founder focus areas, atlas filters | pill buttons |
| Atlas row | worlds | number, name, category colour, status |

## Motion
- Easing `cubic-bezier(.2,.8,.2,1)`, reveals 1.1–1.6 s.
- Everything decorative turns off with Studio "Calm" or the system reduced-motion setting.
- Smooth scroll (Lenis) only with full motion.

## Studio moods
natural (amber), noir (bone), dusk (#ff8a5c), arctic (#8fd0ff), neon (#ff5ce1): each changes the signal colour and image toning.

## Accessibility rules
Skip link, visible focus, real buttons and links, `aria-label` on landmarks, alt text on content images, colour contrast on ink, no information by colour alone (status is also written).
