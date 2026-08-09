# VV Duty Roster

Complete mobile-first React/Vite roster dashboard.

## Features
- CSV/XLS/XLSX import
- Screenshot/photo OCR with Tesseract
- LocalStorage persistence
- Dashboard
- Weekly overview
- Monthly calendar
- Search and filters
- Team filtering
- Shift-hour calculation from start/end times
- Weekly/monthly hours
- Configurable weekly overtime threshold
- CSV/Excel export
- iPhone-friendly responsive UI

## Run
npm install
npm run dev

## Build
npm run build
npm run preview

Data is stored locally in the browser. No server/database is included.

## Screenshot roster import (v2)
Image imports are preprocessed (upscaled, grayscale, contrast enhanced), OCR'd, and scanned for staff rows. A review screen lets you choose your name and the first roster date before importing the 14 daily cells. Recognized codes include RDO, AL/ALLV, ALTH, HACC, TRNG/OFF and HHMM-HHMM time ranges.
