#!/usr/bin/env python3
import re

# --- Configuration ---
INPUT_FILE = "rigveda_translation_griffith.txt"
OUTPUT_FILE = "rigveda_translation_griffith_CLEAN.txt"
# --- End Configuration ---

def clean_translation_file():
    """
    Reads the raw scraped translation file and extracts only hymn titles
    and numbered verse lines, saving them to a new, clean file.
    """
    print(f">>> Cleaning the raw translation file: '{INPUT_FILE}'")

    try:
        with open(INPUT_FILE, "r", encoding="utf-8") as f_in, \
             open(OUTPUT_FILE, "w", encoding="utf-8") as f_out:

            for line in f_in:
                stripped_line = line.strip()

                # Keep lines that are hymn titles (e.g., "HYMN I. Agni.")
                if stripped_line.startswith("HYMN"):
                    f_out.write(stripped_line + "\n")
                    
                # Keep lines that are verse translations (start with a number and a period)
                # e.g., "1. I Laud Agni, the chosen Priest..."
                elif re.match(r"^\d+\.", stripped_line):
                    f_out.write(stripped_line + "\n")

    except FileNotFoundError:
        print(f"[ERROR] The input file '{INPUT_FILE}' was not found.")
        print("        Please make sure you have run the download script successfully.")
        return

    print(f">>> Success! Cleaned data has been saved to '{OUTPUT_FILE}'.")

if __name__ == "__main__":
    clean_translation_file()