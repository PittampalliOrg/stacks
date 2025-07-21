import { Project, SourceFile, ClassDeclaration, Node } from 'ts-morph';
import * as path from 'path';

/**
 * Represents a chart analyzed from TypeScript source
 */
export interface AnalyzedChart {
  /** The source file path */
  filePath: string;
  /** The chart class name */
  className: string;
  /** Base class or parent chart */
  baseClass?: string;
  /** Imported dependencies */
  imports: ChartImport[];
  /** Constructor dependencies */
  constructorDependencies: ConstructorDependency[];
  /** JSDoc documentation */
  documentation?: ChartDocumentation;
  /** Props interface if defined */
  propsInterface?: PropsInterface;
  /** Method calls that might indicate relationships */
  methodCalls: MethodCall[];
}

export interface ChartImport {
  /** The module being imported from */
  moduleSpecifier: string;
  /** Named imports from the module */
  namedImports: string[];
  /** Whether this is a chart import */
  isChartImport: boolean;
}

export interface ConstructorDependency {
  /** Parameter name */
  name: string;
  /** Type name */
  typeName: string;
  /** Whether it's optional */
  isOptional: boolean;
  /** The module it's imported from */
  importPath?: string;
}

export interface ChartDocumentation {
  /** Main description */
  description?: string;
  /** JSDoc tags */
  tags: { tagName: string; text?: string }[];
  /** Example code */
  example?: string;
}

export interface PropsInterface {
  /** Interface name */
  name: string;
  /** Properties defined in the interface */
  properties: InterfaceProperty[];
  /** What it extends */
  extends?: string[];
}

export interface InterfaceProperty {
  /** Property name */
  name: string;
  /** Type as string */
  type: string;
  /** Whether it's optional */
  isOptional: boolean;
  /** JSDoc for the property */
  documentation?: string;
}

export interface MethodCall {
  /** Method name being called */
  methodName: string;
  /** The receiver of the method call */
  receiver?: string;
  /** Arguments passed */
  arguments: string[];
  /** Line number where the call occurs */
  line: number;
}

/**
 * Analyzes TypeScript CDK8s chart files using ts-morph
 */
export class TypeScriptAstAnalyzer {
  private project: Project;
  private analyzedCharts: Map<string, AnalyzedChart> = new Map();

  constructor(projectRoot: string) {
    this.project = new Project({
      tsConfigFilePath: path.join(projectRoot, 'tsconfig.json'),
      skipAddingFilesFromTsConfig: true,
    });
  }

  /**
   * Analyze all chart files in the project
   */
  public async analyzeCharts(chartPaths: string[]): Promise<Map<string, AnalyzedChart>> {
    // Add source files
    for (const chartPath of chartPaths) {
      this.project.addSourceFileAtPath(chartPath);
    }

    // Analyze each file
    for (const sourceFile of this.project.getSourceFiles()) {
      const analyzed = this.analyzeChartFile(sourceFile);
      if (analyzed) {
        this.analyzedCharts.set(analyzed.className, analyzed);
      }
    }

    return this.analyzedCharts;
  }

  /**
   * Analyze a single chart file
   */
  private analyzeChartFile(sourceFile: SourceFile): AnalyzedChart | null {
    // Find the main chart class (extends Chart)
    const chartClass = this.findChartClass(sourceFile);
    if (!chartClass) {
      return null;
    }

    const className = chartClass.getName() || 'UnknownChart';
    
    return {
      filePath: sourceFile.getFilePath(),
      className,
      baseClass: this.getBaseClass(chartClass),
      imports: this.extractImports(sourceFile),
      constructorDependencies: this.extractConstructorDependencies(chartClass),
      documentation: this.extractDocumentation(chartClass),
      propsInterface: this.extractPropsInterface(sourceFile, className),
      methodCalls: this.extractMethodCalls(chartClass),
    };
  }

  /**
   * Find the chart class in a source file
   */
  private findChartClass(sourceFile: SourceFile): ClassDeclaration | null {
    const classes = sourceFile.getClasses();
    
    for (const cls of classes) {
      const baseClass = cls.getBaseClass();
      if (baseClass) {
        const baseClassName = baseClass.getName();
        // Check if it extends Chart or a class that ends with Chart
        if (baseClassName === 'Chart' || baseClassName?.endsWith('Chart')) {
          return cls;
        }
      }
    }
    
    return null;
  }

  /**
   * Get the base class name
   */
  private getBaseClass(cls: ClassDeclaration): string | undefined {
    const baseClass = cls.getBaseClass();
    return baseClass?.getName();
  }

  /**
   * Extract imports from a source file
   */
  private extractImports(sourceFile: SourceFile): ChartImport[] {
    const imports: ChartImport[] = [];
    
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      const namedImports = importDecl.getNamedImports().map(ni => ni.getName());
      
      const isChartImport = moduleSpecifier.includes('chart') || 
                          namedImports.some(name => name.includes('Chart'));
      
      imports.push({
        moduleSpecifier,
        namedImports,
        isChartImport,
      });
    }
    
    return imports;
  }

  /**
   * Extract constructor dependencies
   */
  private extractConstructorDependencies(cls: ClassDeclaration): ConstructorDependency[] {
    const constructor = cls.getConstructors()[0];
    if (!constructor) {
      return [];
    }

    const dependencies: ConstructorDependency[] = [];
    const parameters = constructor.getParameters();
    
    // Skip scope and id parameters, focus on props
    const propsParam = parameters.find(p => p.getName() === 'props');
    if (!propsParam) {
      return [];
    }

    const typeNode = propsParam.getTypeNode();
    if (!typeNode) {
      return [];
    }

    // If it's a type reference, try to find the interface
    if (Node.isTypeReference(typeNode)) {
      const typeName = typeNode.getTypeName().getText();
      const sourceFile = cls.getSourceFile();
      const propsInterface = sourceFile.getInterface(typeName);
      
      if (propsInterface) {
        for (const prop of propsInterface.getProperties()) {
          const propType = prop.getType().getText();
          // Look for chart dependencies
          if (propType.includes('Chart')) {
            dependencies.push({
              name: prop.getName(),
              typeName: propType.replace('?', '').trim(),
              isOptional: prop.hasQuestionToken(),
              importPath: this.findImportPath(sourceFile, propType),
            });
          }
        }
      }
    }
    
    return dependencies;
  }

  /**
   * Find the import path for a type
   */
  private findImportPath(sourceFile: SourceFile, typeName: string): string | undefined {
    // Remove generic parameters and optional marker
    const cleanTypeName = typeName.replace(/<.*>/, '').replace('?', '').trim();
    
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const namedImports = importDecl.getNamedImports();
      if (namedImports.some(ni => ni.getName() === cleanTypeName)) {
        return importDecl.getModuleSpecifierValue();
      }
    }
    
    return undefined;
  }

  /**
   * Extract JSDoc documentation
   */
  private extractDocumentation(cls: ClassDeclaration): ChartDocumentation | undefined {
    const jsDocs = cls.getJsDocs();
    if (jsDocs.length === 0) {
      return undefined;
    }

    const jsDoc = jsDocs[0];
    const description = jsDoc.getDescription().trim();
    const tags = jsDoc.getTags().map(tag => ({
      tagName: tag.getTagName(),
      text: tag.getCommentText()?.trim(),
    }));

    const exampleTag = tags.find(t => t.tagName === 'example');
    
    return {
      description: description || undefined,
      tags: tags.filter(t => t.tagName !== 'example'),
      example: exampleTag?.text,
    };
  }

  /**
   * Extract props interface
   */
  private extractPropsInterface(sourceFile: SourceFile, className: string): PropsInterface | undefined {
    const interfaceName = `${className}Props`;
    const propsInterface = sourceFile.getInterface(interfaceName);
    
    if (!propsInterface) {
      return undefined;
    }

    const properties: InterfaceProperty[] = [];
    for (const prop of propsInterface.getProperties()) {
      const propType = prop.getType().getText();
      const jsDocs = prop.getJsDocs();
      
      properties.push({
        name: prop.getName(),
        type: propType,
        isOptional: prop.hasQuestionToken(),
        documentation: jsDocs[0]?.getDescription().trim(),
      });
    }

    const extendsClauses = propsInterface.getExtends().map(e => e.getText());
    
    return {
      name: interfaceName,
      properties,
      extends: extendsClauses.length > 0 ? extendsClauses : undefined,
    };
  }

  /**
   * Extract method calls that might indicate relationships
   */
  private extractMethodCalls(cls: ClassDeclaration): MethodCall[] {
    const methodCalls: MethodCall[] = [];
    const constructor = cls.getConstructors()[0];
    
    if (!constructor) {
      return methodCalls;
    }

    // Visit all call expressions in the constructor
    constructor.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const expression = node.getExpression();
        
        if (Node.isPropertyAccessExpression(expression)) {
          const methodName = expression.getName();
          const receiver = expression.getExpression().getText();
          
          // Look for interesting method calls
          if (['addDependency', 'addJsonPatch', 'createApplication', 'createHelmApplication'].includes(methodName)) {
            methodCalls.push({
              methodName,
              receiver,
              arguments: node.getArguments().map(arg => arg.getText()),
              line: node.getStartLineNumber(),
            });
          }
        } else if (Node.isIdentifier(expression)) {
          const methodName = expression.getText();
          
          // Look for constructor calls
          if (methodName.includes('Chart') || methodName.startsWith('Kube')) {
            methodCalls.push({
              methodName,
              arguments: node.getArguments().map(arg => arg.getText()),
              line: node.getStartLineNumber(),
            });
          }
        }
      }
    });
    
    return methodCalls;
  }

  /**
   * Get relationships between charts based on analysis
   */
  public getChartRelationships(): ChartRelationship[] {
    const relationships: ChartRelationship[] = [];
    
    for (const [chartName, chart] of this.analyzedCharts) {
      // Constructor dependencies
      for (const dep of chart.constructorDependencies) {
        relationships.push({
          source: chartName,
          target: dep.typeName,
          type: 'constructor-dependency',
          isOptional: dep.isOptional,
        });
      }
      
      // addDependency calls
      const addDepCalls = chart.methodCalls.filter(mc => mc.methodName === 'addDependency');
      for (const call of addDepCalls) {
        if (call.arguments.length > 0) {
          // Extract the target from the argument
          const target = this.extractChartNameFromExpression(call.arguments[0]);
          if (target) {
            relationships.push({
              source: chartName,
              target,
              type: 'explicit-dependency',
              isOptional: false,
            });
          }
        }
      }
      
      // Chart imports that might indicate relationships
      for (const imp of chart.imports) {
        if (imp.isChartImport) {
          for (const namedImport of imp.namedImports) {
            if (namedImport.endsWith('Chart') && namedImport !== chartName) {
              relationships.push({
                source: chartName,
                target: namedImport,
                type: 'import-dependency',
                isOptional: true,
              });
            }
          }
        }
      }
    }
    
    return relationships;
  }

  /**
   * Extract chart name from an expression
   */
  private extractChartNameFromExpression(expr: string): string | null {
    // Handle simple identifiers
    if (/^[a-zA-Z_]\w*$/.test(expr)) {
      return expr;
    }
    
    // Handle property access (e.g., this.infraSecrets)
    const match = expr.match(/this\.(\w+)/);
    if (match) {
      return match[1];
    }
    
    return null;
  }
}

export interface ChartRelationship {
  source: string;
  target: string;
  type: 'constructor-dependency' | 'explicit-dependency' | 'import-dependency';
  isOptional: boolean;
}