// Tailwind 3.4 deliberately, matching the version cdn.tailwindcss.com served
// before this build replaced it. Staying on the same minor keeps the rendered
// pixels identical, which matters because the contrast ratios documented in
// README.md were measured against those exact colors.
export default {
  content: ["./views/**/*.ejs"],
  theme: {
    extend: {}
  },
  plugins: []
};
