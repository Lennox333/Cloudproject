#!/usr/bin/env bash
set -euo pipefail

# Prompt for AWS URL and port once
read -rp "Enter AWS URL: " AWSURL
# AWSURL="ec2-16-176-8-26.ap-southeast-2.compute.amazonaws.com"
PORT="5000"

echo "AWSURL set to $AWSURL:$PORT"

while true; do
	read -rp "CLI> " cmd args
	IFS=' ' read -r -a argArray <<<"$args"

	case "$cmd" in
	login)
		source ./usr_login.sh "${argArray[@]}"
		echo "ACCESS_TOKEN exported: $ACCESS_TOKEN"

		;;
	logout)
		./usr_logout.sh
		echo

		;;
	register)
		./usr_register.sh "${argArray[@]}"

		;;
	videos-fetch)
		./fetch_videos.sh "${argArray[@]}"
		echo
		;;
	upload)
		./upload.sh "${argArray[@]}"
		echo
		;;
	thumbnail-url)
		./get_thumbnail_url.sh "${argArray[@]}"
		echo
		;;
	watch)
		./video_watch.sh "${argArray[@]}"
		echo
		;;
	delete)
		./video_del.sh "${argArray[@]}"
		echo
		;;

	exit | quit)
		echo "Exiting CLI..."
		break
		;;
	help)
		echo "Available commands: login, logout, register, videos, thumbnails <videoId>, exit"
		;;
	*)
		echo "Unknown command: $cmd (type 'help' for commands)"
		;;
	esac
done
