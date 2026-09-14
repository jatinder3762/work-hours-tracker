# Work Hours Tracker

A responsive work-hours tracker designed to work from the same web URL on iPhone, Android, iPad, tablets, Windows, macOS, and modern browsers.

## Features

- Calendar date selection
- Start and end time entry
- Unpaid break selector
- Automatic paid-hours calculation
- Overnight shift support
- Weekly totals
- Monthly totals
- All-time total
- Edit and delete saved shifts
- Backup export/import
- Responsive mobile and desktop layout
- Offline support after the first successful visit
- Installable web-app support where the browser allows it

## Data storage

Shift data is stored in the browser on each device using localStorage. The same website can be opened on multiple devices, but entries do not automatically synchronize between devices yet.

## Publishing

This repository includes a GitHub Pages workflow in `.github/workflows/pages.yml`.

After GitHub Pages is enabled with **GitHub Actions** as the source, the site should be available at:

`https://jatinder3762.github.io/work-hours-tracker/`

Future pushes to `main` will automatically redeploy the website.
