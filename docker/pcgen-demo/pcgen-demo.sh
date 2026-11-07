#!/bin/sh
set -eu
mkdir -p /config/.pcgen /config/PCGen/characters /config/PCGen/exports
cd /opt/pcgen/lib/app
export JAVA_TOOL_OPTIONS="-Xmx1024m -Dprism.order=sw -Dsun.java2d.opengl=false"
exec /opt/pcgen/bin/PcGen -s /config/.pcgen -m 5e "$@"
