# 🚀 Bocksed - Build & Deployment Instructions

**Version:** 1.0.0  
**Last Updated:** February 21, 2026  
**Platform:** Android (iOS Ready)

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Backend Deployment](#backend-deployment)
4. [Frontend Configuration](#frontend-configuration)
5. [Building APK (Android)](#building-apk-android)
6. [Building AAB (Play Store)](#building-aab-play-store)
7. [Building for iOS](#building-for-ios)
8. [Testing Builds](#testing-builds)
9. [Troubleshooting](#troubleshooting)
10. [Deployment Checklist](#deployment-checklist)

---

## 1. Prerequisites

### Required Software

- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher (or yarn)
- **Git**: Latest version
- **Expo CLI**: `npm install -g expo-cli`
- **EAS CLI**: `npm install -g eas-cli`

### Required Accounts

1. **Expo Account** (Free)
   - Sign up at: https://expo.dev
   - Used for building and deploying

2. **MongoDB Atlas** (Free tier available)
   - Sign up at: https://www.mongodb.com/cloud/atlas
   - Used for database

3. **Cloudinary** (Free tier available)
   - Sign up at: https://cloudinary.com
   - Used for image storage

4. **Vercel** (Free tier available)
   - Sign up at: https://vercel.com
   - Used for backend hosting

5. **Google Play Console** (One-time $25 fee)
   - Required only for Play Store submission
   - Sign up at: https://play.google.com/console

6. **Apple Developer** ($99/year)
   - Required only for iOS App Store
   - Sign up at: https://developer.apple.com

### Verify Installation

```bash
# Check Node.js version
node --version  # Should be v18.0.0 or higher

# Check npm version
npm --version   # Should be v8.0.0 or higher

# Check Expo CLI
expo --version

# Check EAS CLI
eas --version
```

---

## 2. Environment Setup

### 2.1 Clone Repository

```bash
git clone https://github.com/otikanelson/Inventory-Application.git
cd Inventory-Application
```

### 2.2 Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 2.3 Configure Environment Variables

#### Backend Environment (.env)

Create `backend/.env`:

```env
# MongoDB
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/Bocksed?retryWrites=true&w=majority

# Server
PORT=5000
NODE_ENV=production

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# JWT (generate a random secret)
JWT_SECRET=your_super_secret_jwt_key_here
```

#### Frontend Environment (.env)

Create `.env` in root:

```env
# Backend API URL (will be replaced during build)
EXPO_PUBLIC_API_URL=https://your-backend-url.vercel.app/api
```

---

## 3. Backend Deployment

### 3.1 Deploy to Vercel

#### Option A: Using Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy backend
cd backend
vercel --prod

# Note the deployment URL
```

#### Option B: Using Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click "New Project"
3. Import your GitHub repository
4. Set root directory to `backend`
5. Add environment variables from `backend/.env`
6. Click "Deploy"
7. Note the deployment URL

### 3.2 Configure Environment Variables in Vercel

1. Go to Project Settings > Environment Variables
2. Add all variables from `backend/.env`:
   - `MONGO_URI`
   - `PORT` (set to 5000)
   - `NODE_ENV` (set to production)
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `JWT_SECRET`

### 3.3 Verify Backend Deployment

```bash
# Test health endpoint
curl https://your-backend-url.vercel.app/

# Test API endpoint
curl https://your-backend-url.vercel.app/api

# Test database connection
curl https://your-backend-url.vercel.app/api/test-db
```

Expected responses:
- `/` - Returns API info
- `/api` - Returns endpoints list
- `/api/test-db` - Returns MongoDB connection status

---

## 4. Frontend Configuration

### 4.1 Update API URL

Update `.env` with your deployed backend URL:

```env
EXPO_PUBLIC_API_URL=https://your-backend-url.vercel.app/api
```

### 4.2 Update app.json

Verify `app.json` configuration:

```json
{
  "expo": {
    "name": "Bocksed",
    "slug": "Bocksed",
    "version": "1.0.0",
    "owner": "neil2022",
    "android": {
      "package": "com.son_the_nel.Inventory",
      "versionCode": 1
    }
  }
}
```

### 4.3 Update eas.json

Verify `eas.json` has correct profiles:

```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://your-backend-url.vercel.app/api"
      }
    },
    "production-aab": {
      "android": {
        "buildType": "app-bundle"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://your-backend-url.vercel.app/api"
      }
    }
  }
}
```

---

## 5. Building APK (Android)

### 5.1 Login to EAS

```bash
# Logout from any existing account
eas logout

# Login with your account
eas login
```

### 5.2 Configure EAS Build

```bash
# Initialize EAS (if not already done)
eas build:configure
```

### 5.3 Build APK

```bash
# Build production APK
eas build --platform android --profile production --clear-cache
```

**Build Process**:
1. EAS uploads your code
2. Builds on Expo servers
3. Takes 10-20 minutes
4. Provides download link when complete

### 5.4 Download APK

```bash
# Download from EAS dashboard
# Or use the link provided in terminal
```

### 5.5 Install APK on Device

**Method 1: Direct Install**
1. Transfer APK to Android device
2. Enable "Install from Unknown Sources"
3. Tap APK file to install

**Method 2: ADB Install**
```bash
# Connect device via USB
adb install path/to/your-app.apk
```

---

## 6. Building AAB (Play Store)

### 6.1 Build AAB

```bash
# Build production AAB (App Bundle)
eas build --platform android --profile production-aab --clear-cache
```

### 6.2 Download AAB

Download the `.aab` file from EAS dashboard or provided link.

### 6.3 Prepare for Play Store

#### Generate Upload Key (First Time Only)

```bash
# EAS handles this automatically
# Key is stored securely in EAS
```

#### Create Play Store Listing

1. Go to https://play.google.com/console
2. Create new app
3. Fill in app details:
   - App name: Bocksed
   - Description: [Use description from PROJECT_DOCUMENTATION.md]
   - Category: Business
   - Screenshots: [Prepare 2-8 screenshots]
   - Feature graphic: [1024x500 image]

#### Upload AAB

1. Go to Production > Create new release
2. Upload your `.aab` file
3. Fill in release notes
4. Submit for review

**Review Process**:
- Takes 1-7 days
- Google reviews for policy compliance
- You'll receive email when approved

---

## 7. Building for iOS

### 7.1 Prerequisites

- Mac computer (required for iOS builds)
- Apple Developer account ($99/year)
- Xcode installed

### 7.2 Configure iOS in app.json

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.Bocksed",
      "buildNumber": "1.0.0",
      "supportsTablet": true
    }
  }
}
```

### 7.3 Build for iOS

```bash
# Build for iOS
eas build --platform ios --profile production
```

### 7.4 Submit to App Store

```bash
# Submit to TestFlight/App Store
eas submit --platform ios
```

**Note**: iOS builds require:
- Apple Developer account
- App Store Connect setup
- Certificates and provisioning profiles (EAS handles this)

---

## 8. Testing Builds

### 8.1 Test APK Before Distribution

**Checklist**:
- [ ] App launches successfully
- [ ] Login works (admin and staff)
- [ ] Dashboard loads with correct data
- [ ] Barcode scanner works
- [ ] Can add/edit/delete products
- [ ] AI predictions display
- [ ] Alerts system works
- [ ] Admin features accessible
- [ ] No crashes or errors
- [ ] Performance is acceptable

### 8.2 Test on Multiple Devices

Test on:
- Different Android versions (8.0+)
- Different screen sizes
- Different manufacturers (Samsung, Xiaomi, etc.)

### 8.3 Beta Testing

**Internal Testing**:
1. Install on 5-10 devices
2. Use for 1-2 weeks
3. Collect feedback
4. Fix critical issues

**External Testing** (Optional):
1. Create closed beta in Play Console
2. Invite 20-50 testers
3. Collect feedback
4. Iterate and improve

---

## 9. Troubleshooting

### 9.1 Build Failures

**Error: "Build failed"**
```bash
# Clear cache and retry
eas build --platform android --profile production --clear-cache
```

**Error: "Invalid credentials"**
```bash
# Re-login to EAS
eas logout
eas login
```

**Error: "Package name already exists"**
- Change `android.package` in `app.json`
- Use unique package name

### 9.2 Runtime Errors

**Error: "Network request failed"**
- Check `EXPO_PUBLIC_API_URL` in `.env`
- Verify backend is running
- Check device internet connection

**Error: "Cannot connect to backend"**
- Verify backend URL is correct
- Check Vercel deployment status
- Test backend endpoints manually

**Error: "MongoDB connection failed"**
- Check `MONGO_URI` in Vercel environment variables
- Verify MongoDB Atlas is running
- Check IP whitelist in MongoDB Atlas

### 9.3 Common Issues

**Issue: App crashes on launch**
- Check logs: `adb logcat`
- Verify all dependencies installed
- Rebuild with `--clear-cache`

**Issue: Images not loading**
- Check Cloudinary configuration
- Verify `CLOUDINARY_*` variables in backend
- Test image upload manually

**Issue: Barcode scanner not working**
- Check camera permissions
- Test on physical device (not emulator)
- Verify `expo-camera` is installed

---

## 10. Deployment Checklist

### Pre-Build Checklist

- [ ] All features tested and working
- [ ] No critical bugs
- [ ] Backend deployed and tested
- [ ] Environment variables configured
- [ ] API URL updated in `.env`
- [ ] `app.json` version incremented
- [ ] `android.versionCode` incremented
- [ ] Screenshots prepared
- [ ] App icon finalized
- [ ] Splash screen finalized

### Build Checklist

- [ ] EAS account configured
- [ ] Logged in to correct account
- [ ] Build profile selected (production)
- [ ] Cache cleared
- [ ] Build initiated
- [ ] Build completed successfully
- [ ] APK/AAB downloaded

### Post-Build Checklist

- [ ] APK installed on test device
- [ ] All features tested on device
- [ ] Performance acceptable
- [ ] No crashes or errors
- [ ] Backend connectivity verified
- [ ] Multi-device testing completed
- [ ] Beta testing completed (if applicable)

### Play Store Submission Checklist

- [ ] Google Play Console account created
- [ ] App listing created
- [ ] App details filled in
- [ ] Screenshots uploaded (2-8)
- [ ] Feature graphic uploaded (1024x500)
- [ ] Privacy policy URL provided
- [ ] Content rating completed
- [ ] Pricing set (free/paid)
- [ ] Countries selected
- [ ] AAB uploaded
- [ ] Release notes written
- [ ] Submitted for review

---

## Quick Reference Commands

```bash
# Backend Deployment
cd backend
vercel --prod

# Frontend Build (APK)
eas build --platform android --profile production --clear-cache

# Frontend Build (AAB for Play Store)
eas build --platform android --profile production-aab --clear-cache

# iOS Build
eas build --platform ios --profile production

# Check Build Status
eas build:list

# Download Latest Build
eas build:download --platform android

# View Build Logs
eas build:view [build-id]
```

---

## Support & Resources

### Documentation
- Expo Docs: https://docs.expo.dev
- EAS Build: https://docs.expo.dev/build/introduction/
- React Native: https://reactnative.dev

### Community
- Expo Forums: https://forums.expo.dev
- Stack Overflow: Tag `expo` or `react-native`
- GitHub Issues: https://github.com/otikanelson/Inventory-Application/issues

### Contact
- Developer: [Your Email]
- Project Repository: https://github.com/otikanelson/Inventory-Application

---

**End of Build Instructions**

*Good luck with your deployment! 🚀*
