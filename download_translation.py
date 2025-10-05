#!/usr/bin/env python3
import time
import sys
import re

# --- Script Configuration ---
OUTPUT_FILENAME = "rigveda_translation_griffith.txt"
# This is the base directory URL for the Rig Veda section of the site
BASE_URL = "https://www.sacred-texts.com/hin/rigveda/"
# The pattern for each book's INDEX page (e.g., rvi01.htm)
BOOK_INDEX_URL_PATTERN = "rvi{}.htm"
TOTAL_BOOKS = 10
# Shorter delay for faster scraping, but still polite.
REQUEST_DELAY_SECONDS = 0.5
# --- End Configuration ---

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Required libraries are not installed.")
    print("Please run the following command to install them:")
    print("pip install requests beautifulsoup4")
    sys.exit(1)

def download_all_books():
    """
    Scrapes all 10 books of the Rigveda translation by navigating the site's
    index structure.
    """
    print(f">>> Starting download of Griffith's Rigveda translation.")
    print(f"    Output will be saved to: {OUTPUT_FILENAME}")

    with open(OUTPUT_FILENAME, "w", encoding="utf-8") as output_file:
        for book_num in range(1, TOTAL_BOOKS + 1):
            # Format the book number with a leading zero (e.g., 01, 02)
            book_id_str = str(book_num).zfill(2)
            book_index_url = BASE_URL + BOOK_INDEX_URL_PATTERN.format(book_id_str)

            print(f"\n--- Processing Book {book_num} ---")
            print(f"[*] Fetching hymn list from {book_index_url}...")

            try:
                # Get the index page for the current book
                index_response = requests.get(book_index_url, timeout=30)
                index_response.raise_for_status()
                index_soup = BeautifulSoup(index_response.content, "html.parser")

                # Find all links that point to a hymn page (e.g., href="rv01_001.htm")
                hymn_links = index_soup.find_all('a', href=re.compile(r'^rv\d{2}_\d{3}\.htm$'))
                if not hymn_links:
                    # Fallback for slightly different link formats if the first fails
                    hymn_links = index_soup.find_all('a', href=re.compile(r'^rv.*\.htm$'))

                print(f"[+] Found {len(hymn_links)} hymns in Book {book_num}.")
                output_file.write(f"\n\n--- START OF BOOK {book_num} ---\n\n")

                # Now, loop through each hymn link on the index page
                for link in hymn_links:
                    hymn_url = BASE_URL + link['href']
                    hymn_title = link.get_text(strip=True)
                    print(f"    -> Fetching: {hymn_title} ({link['href']})")

                    try:
                        hymn_response = requests.get(hymn_url, timeout=30)
                        hymn_response.raise_for_status()
                        hymn_soup = BeautifulSoup(hymn_response.content, "html.parser")
                        
                        # Extract text from the body and clean it up
                        body_text = hymn_soup.body.get_text('\n', strip=True)
                        
                        output_file.write(f"\n--- {hymn_title} ---\n")
                        output_file.write(body_text)
                        output_file.write("\n")

                    except requests.exceptions.RequestException as e:
                        print(f"      [!] Skipping hymn {hymn_url} due to error: {e}")
                    
                    # Be polite to the server
                    time.sleep(REQUEST_DELAY_SECONDS)

            except requests.exceptions.RequestException as e:
                print(f"[ERROR] Failed to download index for Book {book_num}. Error: {e}")
                continue

    print("\n>>> All done!")
    print(f"    The complete translation has been successfully saved to '{OUTPUT_FILENAME}'.")

if __name__ == "__main__":
    download_all_books()