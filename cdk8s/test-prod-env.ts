import { App } from 'cdk8s';
import { MyAppChart } from './my-app-chart';

// Create app for production environment
const app = new App();

new MyAppChart(app, 'my-app-prod', {
  environment: 'production',
  gitRepoUrl: 'https://github.com/myorg/myrepo.git',
  githubOrg: 'myorg',
});

app.synth();