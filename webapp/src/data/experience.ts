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
    period: '2025 - Present',
    title: 'Katalon Platform — AI Agents & Automation',
    projects: [
      {
        name: 'AI Authoring Agent & Test Runner',
        responsibilities: [
          'Built AI-powered multi-agent workflows using Google ADK, LiteLLM, and A2A Protocol for automated test-case generation and browser automation orchestration',
          'Built asynchronous AI-driven browser automation runners using Playwright MCP and Chrome DevTools Protocol (CDP)',
          'Integrated Jira, Azure DevOps, PDFs, and spreadsheets into asynchronous context-ingestion pipelines for AI-based test generation',
          'Implemented structured-output agents with tool-calling and retry strategies for reliable automation workflows',
          'Conducted LLM evaluation research supporting model selection, quality optimization, and operational cost reduction',
          'Deployed A2A inspector per team to validate contracts before orchestrator integration',
          'Designed CI/CD pipelines using GitHub Actions, ArgoCD, and reusable composite workflows across AI-agent repositories',
          'Monitored production systems and investigated incidents using Datadog, Grafana, Coralogix, and Langfuse'
        ]
      }
    ],
    technologies: ['Python', 'Google ADK', 'LiteLLM', 'A2A Protocol', 'Playwright MCP', 'CDP', 'Docker', 'ArgoCD', 'Datadog', 'Langfuse', 'Grafana', 'Coralogix']
  },
  {
    period: '2024 - Present',
    title: 'Katalon Authoring — Backend & Platform Engineering',
    projects: [
      {
        name: 'Katalon Authoring & Manual Test',
        responsibilities: [
          'Led backend delivery within a cross-functional squad after team restructuring, driving technical coordination and backend ownership across integration-heavy workflows',
          'Cross-trained frontend engineers on backend workflows to maintain delivery velocity and improve collaboration',
          'Developed backend services and APIs using Kotlin, Quarkus, and Kafka-based distributed architectures for automation orchestration systems',
          'Designed asynchronous snapshot workflows to preserve execution consistency across distributed testing services during execution initialization',
          'Developed ReactJS micro-frontend applications and backend orchestration services for browser-based testing workflows',
          'Maintained shared micro-frontend library for TestOps apps adopted across 5+ engineering teams and 7+ applications',
          'Worked with AWS (EKS, S3), Docker, and Terraform to support deployment automation and infrastructure troubleshooting'
        ]
      }
    ],
    technologies: ['Kotlin', 'Quarkus', 'Kafka', 'React', 'TypeScript', 'Microservices', 'AWS', 'Terraform', 'ArgoCD', 'Grafana']
  },
  {
    period: '2022 - 2024',
    title: 'Katalon TrueTest — AI-Assisted Testing',
    projects: [
      {
        name: 'Platform Engineering & TrueTest',
        responsibilities: [
          'Architected and implemented a custom micro-frontend platform adopted across 5+ engineering teams and 7+ applications within the TestOps ecosystem',
          'Designed MicroApp and MicroComponent patterns supporting isolated deployments, shared navigation, prop injection, and parent-child communication',
          'Developed full-stack features using ReactJS, Java, Quarkus, and Kafka for AI-assisted automation testing workflows',
          'Implemented browser traffic collection and session-recording modules used to generate automation test scripts from real user behaviors',
          'Generated Katalon automation scripts (Python, JavaScript, Java)',
          'Implemented GitHub Actions for testing pipeline with SonarCloud integration'
        ]
      }
    ],
    technologies: ['TypeScript', 'React', 'Micro-frontends', 'Java', 'Quarkus', 'Kafka', 'Python', 'GitHub Actions', 'SonarCloud']
  },
  {
    period: '2021 - 2022',
    title: 'Katalon TestOps — Core Platform',
    projects: [
      {
        name: 'Core TestOps Features',
        responsibilities: [
          'Root Cause Analytics: clustered common exceptions in test results to surface actionable failure patterns (Spring Boot, React)',
          'Visual Testing Engine: implemented image-processing engines using Python and Java to detect abnormal UI changes in customer applications (Spring Boot, React, Python)',
          'TestOps report and analytics dashboard development (Spring Boot, React)',
          'Contributed to Kafdrop open source: added Kafka message publishing and environment-aware debugging capabilities'
        ]
      }
    ],
    technologies: ['Spring Boot', 'React', 'Python', 'Java', 'PostgreSQL']
  }
]
