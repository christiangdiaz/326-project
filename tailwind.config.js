// Tailwind 3.4 deliberately, matching the version cdn.tailwindcss.com served
// before this build replaced it. Staying on the same minor keeps the rendered
// pixels identical, which matters because the contrast ratios documented in
// README.md were measured against those exact colors.
export default {
  // public/app.js is scanned too: it toggles classes at runtime, and a class
  // that only ever appears in JavaScript is invisible to the content scan and
  // would be purged out of the built stylesheet.
  content: ["./views/**/*.ejs", "./public/app.js"],
  theme: {
    extend: {}
  },
  plugins: []
};
