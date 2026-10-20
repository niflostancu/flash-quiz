# Flash Quiz (FQuiz)

I want to build a Kahoot-style fast-paced quiz using web technologies.
The target audience is for serving fast-paced quizzes in university classes in
order to assess the presence and attention of students.

The idea is to have a admin / teacher endpoint which will serve the questions
and possible answers using a video projector, and the students' mobile web 
interface (served from a publicly hosted domain) where they will see just some
buttons for each answer (without labels) or a text box (depending on the
question's type).

The quiz will be synchronized between all users, with questions appearing and
disappearing after a customizable delay (inside the quiz markdown file) and no
answers accepted after a question passes!

This is to avoid students defrauding the quiz (taking it from home instead of
on-premises)!

## Features

Here's the full plan and features that I require:

- based on TypeScript (to minimize unintended runtime bugs) and some popular yet
  easy to learn frontend / backend frameworks (we will decide this together);
- minimalistic design, responsive (desktop + mobile) layout; I want you to use 
  a popular yet simple CSS framework to aid with fonts / flex / positioning / 
  responsiveness (nothing very fancy and NOT Bootstrap); simple colors, NO
  unnecessary shadows / 3D boxes / images / gradients etc.
- the administrator web UI shall have two pages: one to be used for control
  and diagnostics (ability to view the loaded quiz, buttons for starting the
  quiz, resume/pause, end/reset the quiz; show a compact list of registered
  students - total count, each username linked to its stable student ID,
  connected/last-seen - NO EDITOR required; later: search a student and view
  their answers); the other one to be projected to the students
  (with no unintended questions / answers being visible, a customizable
  waiting screen showing instructions / the URL to the students, then each of
  the questions inside the rendered markdown with a countdown timer somewhere 
  visible);
- the mobile frontend must be especially simple, responsive and easy to use:
  have a first-time welcome screen requesting the student's username, then
  a waiting screen (until the admin starts the quiz), the each of the answering
  inputs / buttons as streamed by the server (everything must happen in real
  time);
- the quiz shall be done in Markdown format, a combination of sli.dev slides 
  format (customizable using YAML headers) and Moodle's vert simple Aiken 
  questions format (example code given below);
- I will make the quizzes by hand, NO WEB-BASED EDITOR / CRUD MANAGEMENT
  whatsoever; the quiz file shall be given when starting the server, as CLI
  argument, for starters.
- registration is server-side: when a student joins (username + stable
  per-device student ID), the server records them so the admin can see who is
  in the room (list + total count) and, later, look up a student's answers;
  rejoining with the same student ID must not create a duplicate student;
- student answers will be saved persistently in a sqlite database;
- questions and answers appearing on the projector screen / students' mobile
  devices will be perfectly syncrhronized (sub-second latency! so use WebSocket
  if that's is the most recommended solution - but please search online whether
  there are any issues with mobile platforms, iOS / Android);
- The student answers shall be sent to the server on each click / key press (in
  case of text inputs);
- In case of users changing answers, I want them all persisted (together with an 
  exact timestamp in server milliseconds!);
- Upon refresh of the mobile app, the session must quickly restore to its previous
  state (the answers that the student chose / entered must NOT be lost in any case!);
- I require no grading of the answers, just a CLI tool to export them as CSV (I 
  will make a grader tool separately from the app, such is the UNIX philosophy);
- The server shall have a simple configuration file (YAML-based) to specify port
  / hostname, database path etc.
- No TLS support please, I will use a reverse proxy server!
- Basically, no unnecessary features! I want the simplest thing possible (without 
  sacrificing quality / resiliency).


## Markdown quizz example

```markdown
---
id: 02_crypto_quiz  # associated with the answers inside the database
title: "Cryptography Flash Quiz"  # displayed on waiting screen
answerTime: 15  # default question time, in seconds
---

Quickly press the color you will be told by the teacher!

A.
B.
C.
D.
E.
F.

COMMENT: this should not be displayed on projector UI! + accept empty buttons
         (letter will be the label)
ANSWER: B

---

Which one is a popular, modern (+ secure) **symmetric stream cipher**?

A. RC4
B. TwoFish
C. AES
D. ChaCha20-Poly1305

ANSWER=D

---
answerTime: 6
---
What is the number of bits of an AES block?

TYPE=number

---
```

## Architecture / guidelines

I want the source code organized with a maintainable architecture, with the 
following hints:

- on root-level, necessary build / development metadata & scripts (e.g., 
  package.json, linter configs etc.);
- backend (server-side) and frontend separated in different subdirectories, with
  common library in a `./common/` dir;
- CLI binaries inside `./bin/` (including utility to parse quiz markdown into 
  internal JSON structures - this shall make use of the common library);
- try to separate CSS and media/images from the JS / HTML components;
- keep it containerizable (all written data inside a `./data/` dir / volume,
  git ignored); make required paths configurable!
- use internationalization, with Romanian and English languages for student's UI;
- create .devcontainer, debian 13-based (it will be used for the AI agent after
  the preliminary project structure initialization);
- some recommended automated tests;

