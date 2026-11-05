/* Shared editing for ?edit (see text-edit.js and firebase/README.md).

   The Firebase web app config (console › Project settings › Your apps). With
   it, every editor shares one live copy of the text edits; set to null, ?edit
   keeps edits in each browser only.

   These values are not secret: a Firebase web config is meant to sit in the
   page. Who may read and write is set by firebase/database.rules.json. */
window.TE_FIREBASE = {
  apiKey: "AIzaSyDekVu0DJwpVVccwoalM0MKDL75rkyRSFA",
  authDomain: "cities-dynamic-text.firebaseapp.com",
  databaseURL: "https://cities-dynamic-text-default-rtdb.firebaseio.com",
  projectId: "cities-dynamic-text",
  storageBucket: "cities-dynamic-text.firebasestorage.app",
  messagingSenderId: "114236182334",
  appId: "1:114236182334:web:7deda159bc0c94fc4da66f",
  root: "v5"
};
