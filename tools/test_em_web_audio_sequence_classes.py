#!/usr/bin/env python3
"""Read-only original-ROM check: SFX timebase precedes each first note.

The supported prefix commands are the original GEMS 2.5 sequence opcodes.
This verifier never patches a ROM, extracts audio or changes a game fixture.
"""
import hashlib,json,sys
from pathlib import Path

rom=Path(sys.argv[1]).read_bytes()
assert hashlib.sha256(rom).hexdigest()=='b1bbe73186e0902fa8b2db0f227bf306e3d6a80fe592f927d1aa9d60c0f335ba'
args={0x61:1,0x62:1,0x63:0,0x64:1,0x65:0,0x66:1,0x67:1,0x68:1,0x69:1,0x6a:1,0x6b:1,0x6c:2,0x6d:0,0x6e:1,0x72:2}
def first_note(address):
    sfx=False
    for _ in range(2048):
        code=rom[address];address+=1
        if code<0x60:return sfx
        if code>=0x80:continue # native delay/duration groups
        if code==0x60:return None
        assert code in args,('unsupported pre-note command',hex(code),hex(address-1))
        if code==0x6d:sfx=True
        address+=args[code]
    raise AssertionError('unbounded pre-note prefix')

results=[]
for bank,total in [(0xcf970,13),(0xf6363,84)]:
    for sequence in range(total):
        offset=int.from_bytes(rom[bank+2*sequence:bank+2*sequence+2],'little')
        header=bank+offset;count=rom[header]
        assert count<=16
        for channel in range(count):
            offset=int.from_bytes(rom[header+1+2*channel:header+3+2*channel],'little')
            sfx=first_note(bank+offset)
            if sfx is None:continue # controller-only/empty stream
            expected=sequence!=0 if bank==0xcf970 else rom[0x2dd5c+sequence]!=255
            assert sfx==expected,(hex(bank),sequence,channel,sfx,expected)
            results.append({'bank':hex(bank),'sequence':sequence,'channel':channel,'sfx':sfx})
report={'originalRomSha256':hashlib.sha256(rom).hexdigest(),'prefixes':len(results),'music':sum(not x['sfx'] for x in results),'sfx':sum(x['sfx'] for x in results),'allOriginalStreamsClassifiedBeforeFirstNote':True}
print(json.dumps(report,indent=2))
