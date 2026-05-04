Helper DLP CLI (stub)

Usage:
- dlp-cli.bat scan --in <path> --out <path>

Behavior:
- Exit 0: copies input to output with light cleanup.
- Exit non-zero: blocks if input contains "BLOCKME" or on errors.

Windows:
- Use dlp-cli.bat as the executable path in settings or AHK.


