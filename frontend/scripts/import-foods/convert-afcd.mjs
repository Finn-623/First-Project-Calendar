import { convertAfcd } from './converters/afcd-converter.mjs';

async function run() {
  try {
    const detailsPath = process.argv[2];
    const profilesPath = process.argv[3];
    const outputPath = process.argv[4];
    
    if (!detailsPath || !profilesPath || !outputPath) {
      console.error('Usage: node convert-afcd.mjs <details.xlsx> <profiles.xlsx> <output.json>');
      process.exit(1);
    }
    
    const count = await convertAfcd(detailsPath, profilesPath, outputPath);
    console.log(`Successfully converted ${count} records to ${outputPath}`);
  } catch (err) {
    console.error('Conversion failed:', err);
    process.exit(1);
  }
}

run();
