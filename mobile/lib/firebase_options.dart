import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Firebase config for the existing `pocket-dating-coach` project (same one the
/// Capacitor app used; bundle id com.pocketdatingcoach.app). Values mirror
/// google-services.json (Android) + GoogleService-Info.plist (iOS).
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) throw UnsupportedError('Web is not configured for Firebase.');
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError('Firebase not configured for $defaultTargetPlatform.');
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyCLFfPXUz982sJ86HIPXJCjQrItjOU1ofg',
    appId: '1:239928106804:android:030881f68a5be632544f61',
    messagingSenderId: '239928106804',
    projectId: 'pocket-dating-coach-8bc26',
    storageBucket: 'pocket-dating-coach-8bc26.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyAMrOuw6fK5jULfbwkObVx3Bkyshs9eVdo',
    appId: '1:395638659709:ios:59532d3268ab526befef14',
    messagingSenderId: '395638659709',
    projectId: 'pocket-dating-coach',
    storageBucket: 'pocket-dating-coach.firebasestorage.app',
    iosBundleId: 'com.pocketdatingcoach.app',
  );
}
