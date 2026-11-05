# Shared text editing (?edit)

With `?edit`, cities-v-5 lets the team edit the text column in place
(`text-edit.js`). Once a Firebase project is connected, every editor works on
one live copy:

- changes show for everyone as they are typed;
- a paragraph someone is in is closed to the others until they leave it;
- every change goes into a history, and any version can be restored.

**Sign-in.** Editors type their Harvard email and get a one-time sign-in link
(no password, no Google account needed). Anyone on the editors list (below)
can sign in with Google instead.

The page without `?edit` never loads any of this.

## Connect a Firebase project (once, about 10 minutes)

1. Go to <https://console.firebase.google.com>, click **Create a project** and
   name it, for example `cities-text`. Google Analytics is not needed.
2. **Build › Authentication › Get started › Sign-in method**:
   - **Email/Password**: turn on **both** switches, **Email/Password** and
     **Email link (passwordless sign-in)**. Firebase only enables the link
     option when the first switch is on; without it, sign-in fails with
     "operation not allowed". The editor never offers password sign-up, and
     the rules accept only verified addresses.
   - **Google**: turn it on and choose a support email. This is only for
     people on the editors list.
3. **Authentication › Settings › Authorized domains**: add
   `harvard-growth-lab.github.io`. `localhost` is already there.
4. **Build › Realtime Database › Create database**. Pick a US location and
   start in **locked mode**. Open the **Rules** tab, replace the contents with
   [`database.rules.json`](database.rules.json) and click **Publish**.
5. **Project settings › General › Your apps**: add a **Web** app (`</>`),
   name it `cities-v5`, and leave Firebase Hosting unticked. Copy the
   `firebaseConfig` it shows into `../text-edit-config.js` as
   `window.TE_FIREBASE = { …, root: "v5" }`. Check that it includes
   `databaseURL`.
6. Commit `text-edit-config.js`. It is safe to publish: a Firebase web config
   is not a secret, and the rules decide who gets in.

## Who can edit

- **Any address ending in `harvard.edu`**, including subdomains such as
  `hks.harvard.edu`, by email link. The link proves the address, so only
  people with a Harvard inbox get in this way.
- **Anyone on the editors list**, by email link or by Google. To add someone,
  open **Realtime Database › Data**, hover over the top line, click **+**,
  and add a child under `editors`:
  - key: their address in lower case with every `.` replaced by `,`, for
    example `jane,doe@gmail,com`;
  - value: `true`.

  Delete the line to remove them. Editors cannot see or change this list; only
  the console can.

The sign-in email comes from `noreply@<project>.firebaseapp.com`. If it does
not arrive within a minute, look in junk or quarantine. Each link works once,
expires after a while, and should be opened in the browser that asked for it.
If it is opened elsewhere, the page asks for the email address again.

## For designers: keep `data-text-id`

Each editable text in `index.html` has a permanent tag, for example
`<p data-text-id="overview-lede" class="lede">`. Edits are filed under that
tag, so they follow the text wherever the layout moves it. When you move,
restyle or reorder an element, keep the attribute. Give a new piece of text
its own unique `data-text-id`; without one it still works, filed by its
position in its section.

If an edit can't find its text, because the text was reworded in
`index.html` or moved without its tag, the editor first looks for the text
the edit was made on anywhere on the page and reattaches it there. If that
fails, the bar shows **N not placed**: open it to place each edit on the
right text by clicking, or to discard it.

## Where the data is

Everything is under `v5/` in the Realtime Database (console › Realtime
Database › Data):

- `text/<key>` holds the current edit of each element: `before`, `after`, who
  made it, and when.
- `history/<id>` holds every change once it has settled for 3 seconds. Entries
  are append-only; the rules do not allow them to be changed.
- `presence/<uid>` shows who has edit mode open and which element they are in.

To export, use the editor's **Download** button, or the console's ⋮ menu
› Export JSON. The text in `index.html` only changes when someone applies the
edits there, for example from **Copy changes**.
