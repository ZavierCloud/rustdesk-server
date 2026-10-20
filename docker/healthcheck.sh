#!/bin/sh

/package/admin/s6/command/s6-svstat /run/s6-rc/servicedirs/rd_server_relay || exit 1
/package/admin/s6/command/s6-svstat /run/s6-rc/servicedirs/rd_server_id || exit 1
