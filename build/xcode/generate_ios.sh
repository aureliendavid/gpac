#!/bin/sh

cd "`dirname $0`"

echo "*** Set version within Info.plist application file ***"
version=`grep '#define GPAC_VERSION ' ../../include/gpac/version.h | cut -d '"' -f 2`
TAG=$(git describe --tags --abbrev=0 --match "v*" 2> /dev/null)
REVISION=$(echo `git describe --tags --long --match "v*" 2> /dev/null || echo "UNKNOWN"` | sed "s/^$TAG-//")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2> /dev/null || echo "UNKNOWN")

#sanitize branch name for filenames
DHBRANCH=$(echo "$BRANCH" | sed 's/[^-+.0-9a-zA-Z~]/-/g' )

rev="$REVISION-$DHBRANCH"
if [ "$rev" != "" ]
then
	sed 's/<string>.*<\/string><!-- VERSION_REV_REPLACE -->/<string>'"$version"'<\/string>/' ../../applications/gpac/ios-Info.plist > ../../applications/gpac/ios-Info.plist.new
	sed 's/<string>.*<\/string><!-- BUILD_REV_REPLACE -->/<string>'"$rev"'<\/string>/' ../../applications/gpac/ios-Info.plist.new > ../../applications/gpac/ios-Info.plist
	rm ../../applications/gpac/ios-Info.plist.new
fi

if [ "$rev" != "" ]
then
	full_version="$version-rev$rev"
else
	#if no revision can be extracted, use date
	full_version="$version-$(date +%Y%m%d)"
fi

echo "*** Compile and archive gpac4ios ***"
xcodebuild archive -project gpac4ios.xcodeproj -scheme gpac4ios -archivePath gpac4ios.xcarchive -allowProvisioningUpdates
if [ $? != 0 ] ; then
	exit 1
fi

echo "*** Generate IPA ***"
mkdir -p Payload
mv gpac4ios.xcarchive/Products/Applications/gpac4ios.app Payload/
if [ ! -d "../../bin/iOS" ]; then
	mkdir -p "../../bin/iOS"
fi
zip -r "../../bin/iOS/gpac-$full_version-ios.ipa" Payload
rm -rf Payload
rm -rf gpac4ios.xcarchive
#git pull

echo "*** GPAC generation for iOS completed ($full_version) ! ***"
