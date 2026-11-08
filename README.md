# Money tracker

A small spending tracker. Note what you spent, how much and when, and see
what it adds up to.

Built for the Product Engineering Bootcamp, week 1: plain HTML, CSS and
JavaScript in three files, no backend.

## What it does

- Add an entry: what you spent it on, how much, the date
- See everything in a list, newest date first
- Edit any entry
- Delete any entry, after confirming
- Search by what you spent on
- The number of entries and the total spent at the top
- A friendly message when the list is empty
- Works on a phone

## Where the data lives

In this browser, in `localStorage`. That means:

- it is still there when you close the page and come back
- it is **not** shared: open the link on another phone and you start empty
- clearing your browser data clears the list

## Running it

Open `index.html`, or use **Go Live** in your editor. There is nothing to
install and nothing to build.

## The files

| File | What is in it |
|---|---|
| `index.html` | The page: the form, the search box and the list |
| `style.css` | All the styling, written mobile first |
| `script.js` | Loading and saving, and add / edit / delete / search |

## One thing worth knowing

Dates are stored as plain `YYYY-MM-DD` text and split by hand rather than
passed to `new Date()`. `new Date("2026-11-08")` is read as UTC, so in some
timezones it shows the day before — which would be a confusing bug in an app
whose whole job is recording when you spent something.
