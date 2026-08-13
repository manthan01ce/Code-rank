#!/bin/bash

# cleanup-idle-containers.sh
# Finds all coderank-student-* containers and removes those running for more than 2 hours

echo "Running idle container cleanup..."

# List containers matching the pattern
CONTAINERS=$(docker ps -a --format '{{.Names}}' | grep '^coderank-student-')

for CONTAINER in $CONTAINERS; do
    # Get container start time
    STARTED_AT=$(docker inspect --format='{{.State.StartedAt}}' "$CONTAINER")
    
    # Convert to Unix timestamp
    STARTED_TS=$(date -d "$STARTED_AT" +%s 2>/dev/null)
    
    # Check if conversion failed (e.g., container not running)
    if [ -z "$STARTED_TS" ]; then
        # On some systems, date -d doesn't parse Docker's ISO format perfectly.
        # Fallback to python for safe parsing:
        STARTED_TS=$(python3 -c "from datetime import datetime; import sys; d=sys.argv[1][:19].replace('T',' '); print(int(datetime.strptime(d, '%Y-%m-%d %H:%M:%S').timestamp()))" "$STARTED_AT" 2>/dev/null)
    fi

    if [ -n "$STARTED_TS" ]; then
        CURRENT_TS=$(date +%s)
        DIFF=$((CURRENT_TS - STARTED_TS))
        
        # 7200 seconds = 2 hours
        if [ $DIFF -gt 7200 ]; then
            echo "Removing container $CONTAINER (Running for ${DIFF}s)"
            docker rm -f "$CONTAINER"
        fi
    fi
done

echo "Cleanup complete."
