import * as fs from 'fs';
import * as path from 'path';

export interface ImageConfig {
  nextjs: string;
  backstage: string;
  flagdUi: string;
  claudecodeui: string;
}

export interface AllImageConfigs {
  dev: ImageConfig;
  production: ImageConfig;
}

/**
 * ImageLoader provides a centralized way to load container image configurations
 * from a JSON file instead of environment variables.
 */
export class ImageLoader {
  private static instance: ImageLoader;
  private imageConfigs: AllImageConfigs;
  private currentEnvironment: string;

  private constructor() {
    // Determine current environment
    this.currentEnvironment = process.env.ENVIRONMENT || 'dev';
    
    // Load images.json
    const imagesPath = path.join(__dirname, '../..', '.env-files', 'images.json');
    
    try {
      const fileContent = fs.readFileSync(imagesPath, 'utf8');
      this.imageConfigs = JSON.parse(fileContent);
    } catch (error) {
      console.error(`Failed to load images.json: ${error}`);
      // Fallback to default images
      this.imageConfigs = {
        dev: {
          nextjs: 'ghcr.io/pittampalliorg/chat:latest',
          backstage: 'ghcr.io/pittampalliorg/backstage:latest',
          flagdUi: 'vpittamp.azurecr.io/flagd-ui:latest',
          claudecodeui: 'vpittamp.azurecr.io/claudecodeui:latest'
        },
        production: {
          nextjs: 'ghcr.io/pittampalliorg/chat:latest',
          backstage: 'ghcr.io/pittampalliorg/backstage:latest',
          flagdUi: 'vpittamp.azurecr.io/flagd-ui:latest',
          claudecodeui: 'vpittamp.azurecr.io/claudecodeui:latest'
        }
      };
    }
  }

  /**
   * Get the singleton instance of ImageLoader
   */
  public static getInstance(): ImageLoader {
    if (!ImageLoader.instance) {
      ImageLoader.instance = new ImageLoader();
    }
    return ImageLoader.instance;
  }

  /**
   * Get image for the current environment
   * @param imageName The name of the image (e.g., 'nextjs', 'backstage')
   * @returns The full image URL with tag
   */
  public getImage(imageName: keyof ImageConfig): string {
    const envConfig = this.imageConfigs[this.currentEnvironment as keyof AllImageConfigs];
    if (!envConfig) {
      console.warn(`Environment ${this.currentEnvironment} not found in images.json, falling back to 'dev'`);
      return this.imageConfigs.dev[imageName];
    }
    
    return envConfig[imageName] || this.getDefaultImage(imageName);
  }

  /**
   * Get all images for the current environment
   */
  public getImages(): ImageConfig {
    const envConfig = this.imageConfigs[this.currentEnvironment as keyof AllImageConfigs];
    if (!envConfig) {
      console.warn(`Environment ${this.currentEnvironment} not found in images.json, falling back to 'dev'`);
      return this.imageConfigs.dev;
    }
    return envConfig;
  }

  /**
   * Get images for a specific environment
   */
  public getImagesForEnvironment(environment: string): ImageConfig | undefined {
    return this.imageConfigs[environment as keyof AllImageConfigs];
  }

  /**
   * Get default image when not found in config
   */
  private getDefaultImage(imageName: keyof ImageConfig): string {
    const defaults: ImageConfig = {
      nextjs: 'ghcr.io/pittampalliorg/chat:latest',
      backstage: 'ghcr.io/pittampalliorg/backstage:latest',
      flagdUi: 'vpittamp.azurecr.io/flagd-ui:latest',
      claudecodeui: 'vpittamp.azurecr.io/claudecodeui:latest'
    };
    return defaults[imageName];
  }
}

/**
 * Convenience function to get an image for the current environment
 */
export function getImage(imageName: keyof ImageConfig): string {
  return ImageLoader.getInstance().getImage(imageName);
}

/**
 * Convenience function to get all images for the current environment
 */
export function getImages(): ImageConfig {
  return ImageLoader.getInstance().getImages();
}