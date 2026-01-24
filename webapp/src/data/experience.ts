export interface ExperienceItem {
  period: string
  title: string
  projects: {
    name: string
    responsibilities: string[]
  }[]
  technologies: string[]
}

export const experiences: ExperienceItem[] = [
  {
    period: '2025 - Present (Concurrent)',
    title: 'Katalon Platform',
    projects: [
      {
        name: 'Manual Test Runner & Test Case Generator Agents',
        responsibilities: [
          'Partnered with CloudOps to define deployment pipelines and own release execution',
          'Made technical decisions for deployment and rollout strategy',
          'Supported the DevOps team in managing team infrastructure and operations',
          'Integrated Google ADK A2A protocol so parent agents can orchestrate child agents for test case generation and execution',
          'Deployed an A2A inspector per team to validate contracts before orchestrator integration',
          'Maintained 100% agent uptime since launch'
        ]
      }
    ],
    technologies: ['Docker', 'Python', 'Grafana', 'Microservices', 'Kotlin', 'Quarkus']
  },
  {
    period: '2024 - Present (Concurrent)',
    title: 'Katalon TestOps Gen3',
    projects: [
      {
        name: 'Katalon Manual Test',
        responsibilities: [
          'Full software lifecycle responsibility for backend development',
          'Develop backend features as microservices (Quarkus + Kotlin)',
          'Maintain shared micro-frontend library for TestOps apps (TypeScript, React)',
          'Supported micro-frontend integration for FE team'
        ]
      },
      {
        name: 'Katalon Test Cases Generation using GenAI',
        responsibilities: [
          'Full software lifecycle under tech lead supervision',
          'Develop Katalon Authoring backend microservices (Quarkus + Kotlin)'
        ]
      }
    ],
    technologies: ['Quarkus', 'Kotlin', 'Microservices', 'Grafana', 'TypeScript', 'React']
  },
  {
    period: '2022 - 2024',
    title: 'Katalon AI - True Test',
    projects: [
      {
        name: 'AI-powered Autonomous Testing',
        responsibilities: [
          'Crafted Micro-frontend library for seamless team collaboration (TypeScript)',
          'Contributed to TrueTest AI-powered autonomous testing software',
          'Developed UI for Child app integrated into TestOps (ReactJs)',
          'Collaborated on CRUD Back-End development (Quarkus)',
          'Generated Katalon Automation Scripts (Python, JavaScript, Java)',
          'Developed Traffic Agent module for user behavior collection (JavaScript)',
          'Implemented Github Actions for testing pipeline with SonarCloud integration'
        ]
      }
    ],
    technologies: ['TypeScript', 'React', 'Quarkus', 'Python', 'JavaScript', 'Java', 'GitHub Actions']
  },
  {
    period: '2021 - 2022',
    title: 'Katalon TestOps',
    projects: [
      {
        name: 'Core TestOps Features',
        responsibilities: [
          'Root Cause Analytics: Clustered common exceptions in test results (Spring, React)',
          'Visual Testing: Image capture and comparison between tests (Spring, React, Python)',
          'TestOps report and Analytics dashboard development (Spring, React)'
        ]
      }
    ],
    technologies: ['Spring Boot', 'React', 'Python', 'Analytics']
  }
]
