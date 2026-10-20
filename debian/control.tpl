Source: rd_server
Section: net
Priority: optional
Maintainer: open-trade <info@rd_server.com>
Build-Depends: debhelper (>= 10), pkg-config
Standards-Version: 4.5.0
Homepage: https://rd_server.com/

Package: rd_server-rd_server_id
Architecture: {{ ARCH }}
Depends: systemd ${misc:Depends}
Description: RD Server server
 Self-host your own RD Server server, it is free and open source.

Package: rd_server-rd_server_relay
Architecture: {{ ARCH }}
Depends: systemd ${misc:Depends}
Description: RD Server server
 Self-host your own RD Server server, it is free and open source.
 This package contains the RD Server relay server.

Package: rd_server-utils
Architecture: {{ ARCH }}
Depends: ${misc:Depends}
Description: RD Server server
 Self-host your own RD Server server, it is free and open source.
 This package contains the rd_server_utils binary.
