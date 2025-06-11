from shapely import wkb
import binascii

wkb_hex = '0101000020E61000003333333333935AC0C442AD69DEB13F40'  # your MBR
geom = wkb.loads(binascii.unhexlify(wkb_hex))
print(geom.wkt)
