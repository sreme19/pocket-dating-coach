# Setup Scripts

## FAL_KEY Configuration

The FAL_KEY is required to enable AI photo generation with fal.ai. Use one of these methods to configure it:

### Method 1: npm script (recommended)

```bash
npm run setup:fal
```

This will prompt you interactively for your FAL_KEY and add it to `.env.local`.

### Method 2: npm script with key as argument

```bash
npm run setup:fal -- your_fal_key_here
```

### Method 3: Direct bash script

```bash
./scripts/setup-fal-key.sh
```

Or with key as argument:

```bash
./scripts/setup-fal-key.sh your_fal_key_here
```

### Method 4: Direct Node.js script

```bash
node scripts/setup-fal-key.js
```

Or with key as argument:

```bash
node scripts/setup-fal-key.js your_fal_key_here
```

### Method 5: Manual setup

1. Get your FAL_KEY from [fal.ai](https://fal.ai)
2. Open `.env.local` in your editor
3. Add or update the line: `FAL_KEY=your_key_here`
4. Save and restart your dev server

## After Setup

1. Restart your dev server: `npm run dev`
2. Go through the verification flow and upload a photo in Step 3
3. Navigate to your profile page
4. Click "Enhance with AI" to generate AI-enhanced photos

## Troubleshooting

- **"FAL_KEY is not configured"**: Make sure you ran the setup script and restarted the dev server
- **Generation fails**: Check that your FAL_KEY is valid at [fal.ai](https://fal.ai)
- **Slow generation**: First generation takes ~30 seconds. Subsequent generations are cached.
