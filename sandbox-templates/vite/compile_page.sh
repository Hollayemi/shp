#!/bin/bash

# This script runs when the sandbox starts
# Optimized for fast startup with pre-bundled dependencies
function ping_server() {
	counter=0
	response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000")
	while [[ ${response} -ne 200 ]]; do
	  let counter++
	  if  (( counter % 10 == 0 )); then
        echo "Starting optimized dev server..."
        sleep 0.05
      fi

	  response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000")
	done
	echo "✅ Dev server ready! Dependencies were pre-bundled for fast startup."
}

ping_server &
cd /home/user && npm run dev -- --host 0.0.0.0 --port 3000 