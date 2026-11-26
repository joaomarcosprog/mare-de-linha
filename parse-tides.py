"""Extract the public numerical tide observations from CHM's 3-page station table."""
from calendar import monthrange
from pathlib import Path
import json
import re
import sys

import pymupdf


def extract(document, year):
    days = {}
    for page_index, page in enumerate(document):
        words = page.get_text('words')
        columns = sorted((x, y) for x, y, *_, s, _b, _l, _w in words if s == 'HORA')
        if len(columns) != 8:
            raise ValueError(f'Expected eight half-month columns on page {page_index + 1}')
        for column, (x, header_y) in enumerate(columns):
            month = page_index * 4 + column // 2 + 1
            markers = sorted((y, int(s)) for a, y, *_, s, _b, _l, _w in words
                             if abs(a - (x - 15.6)) < 3 and y > header_y and re.fullmatch(r'\d{2}', s))
            expected = list(range(1, 17) if column % 2 == 0 else range(17, monthrange(year, month)[1] + 1))
            if [number for _, number in markers] != expected:
                raise ValueError(f'Unexpected day markers for {year}-{month:02}: {markers}')
            times = sorted((y, s) for a, y, *_, s, _b, _l, _w in words
                           if abs(a - (x + 4.4)) < 4 and y > header_y and re.fullmatch(r'\d{4}', s))
            heights = [(y, float(s.replace(',', '.'))) for a, y, *_, s, _b, _l, _w in words
                       if abs(a - (x + 23.7)) < 6 and y > header_y and re.fullmatch(r'-?\d+[.,]\d{2}', s)]
            if len(times) != len(heights):
                raise ValueError(f'Time/height count differs for page {page_index + 1}, column {column + 1}')
            for position, (y, day) in enumerate(markers):
                end = markers[position + 1][0] if position + 1 < len(markers) else float('inf')
                events = []
                for event_y, hhmm in times:
                    if y - 1 <= event_y < end - 1:
                        matches = [value for height_y, value in heights if abs(height_y - event_y) < 1]
                        minute = int(hhmm[:2]) * 60 + int(hhmm[2:])
                        if len(matches) != 1 or minute > 1439 or int(hhmm[2:]) > 59:
                            raise ValueError(f'Invalid event at {year}-{month}-{day} {hhmm}')
                        events.append([minute, matches[0]])
                if not 2 <= len(events) <= 6 or events != sorted(events):
                    raise ValueError(f'Unexpected events at {year}-{month}-{day}: {events}')
                days[f'{year}-{month:02}-{day:02}'] = events
    if len(days) != sum(monthrange(year, m)[1] for m in range(1, 13)):
        raise ValueError('Incomplete year')
    return days


if __name__ == '__main__':
    pdf, year, destination = sys.argv[1:]
    with pymupdf.open(pdf) as document:
        result = extract(document, int(year))
    Path(destination).write_text(json.dumps(result, separators=(',', ':')), encoding='utf-8')
    print(f'{len(result)} days / {sum(map(len, result.values()))} events')
