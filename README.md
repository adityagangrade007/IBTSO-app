# IBTSO Retail Intelligence — static demo
Pure static site (no build, no backend). Data is generated in the browser; users/entries persist in localStorage.
Deploy: `npx vercel --prod` from this folder (or import the folder in the Vercel dashboard, framework "Other", no build command).
Local: `python3 -m http.server 8001`.

Accounts (password demo123; admin ibtso123): admin@ibtso.com (Admin), lg|samsung|midea|toshiba|philips|haier|hitachi@demo.com (Brand Manager), viewer@lg.demo.com (Brand Viewer). Anyone can sign up (starts as Viewer).
