#!/usr/bin/env python3
"""Build the complete original descriptions-only tutorial package."""
import argparse
from pathlib import Path
from extend_tutorial_native import main
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--raw',type=Path)
 parser.add_argument('--output',type=Path)
 args=parser.parse_args()
 main(args.raw,args.output)
