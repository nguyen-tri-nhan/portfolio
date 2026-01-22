import { ExternalLink, Calendar, ChevronRight } from 'lucide-react'

interface ExperienceItem {
  period: string
  title: string
  projects: {
    name: string
    responsibilities: string[]
  }[]
  technologies: string[]
}

const experiences: ExperienceItem[] = [
  {
    period: '2025 - Present',
    title: 'Katalon Platform',
    projects: [
      {
        name: 'Manual Test Runner & Test Case Generator Agents',
        responsibilities: [
          'Partnered with CloudOps to define deployment pipelines and own release execution',
          'Made technical decisions for deployment and rollout strategy',
          'Supported the DevOps team in managing team infrastructure and operations',
          'Develop backend features and integrate with orchestration agent via A2A protocol'
        ]
      }
    ],
    technologies: ['Docker', 'Python', 'Grafana', 'Microservices', 'Kotlin', 'Quarkus']
  },
  {
    period: '2024 - Present',
    title: 'Katalon TestOps Gen3',
    projects: [
      {
        name: 'Katalon Manual Test',
        responsibilities: [
          'Full software lifecycle responsibility for backend development',
          'Develop backend features as microservices (Quarkus + Kotlin)',
          'Support Microfrontend integration for FE team'
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

export default function Experience() {
  return (
    <section id="experience" className="py-20 px-4 relative z-10 bg-darker/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Professional <span className="text-primary">Experience</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            5+ years at Katalon, contributing to test automation and AI-powered testing solutions
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center p-2 shadow-sm">
                <img 
                  src="https://2465122.fs1.hubspotusercontent-na1.net/hub/2465122/hubfs/g_fNa7d1_400x400%20(1).jpg?width=108&height=108" 
                  alt="Katalon Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-primary">Software Engineer</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-xl font-semibold">Katalon</span>
                  <a
                    href="https://katalon.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-primary transition-colors"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
                <p className="text-gray-400">2021 - Present</p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {experiences.map((exp, index) => (
              <div key={index} className="project-card">
                <div className="flex items-center space-x-3 mb-4">
                  <Calendar size={20} className="text-primary" />
                  <h4 className="text-xl font-bold text-primary">{exp.title}</h4>
                  <span className="text-gray-400">({exp.period})</span>
                </div>
                
                <div className="space-y-6">
                  {exp.projects.map((project, projectIndex) => (
                    <div key={projectIndex}>
                      <h5 className="font-semibold text-gray-200 mb-3">{project.name}</h5>
                      <ul className="space-y-2">
                        {project.responsibilities.map((responsibility, respIndex) => (
                          <li key={respIndex} className="flex items-start space-x-2 text-gray-300">
                            <ChevronRight size={16} className="text-primary mt-0.5 flex-shrink-0" />
                            <span className="text-sm leading-relaxed">{responsibility}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  
                  <div className="flex flex-wrap gap-2 pt-4">
                    {exp.technologies.map((tech) => (
                      <span
                        key={tech}
                        className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full border border-primary/20"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <a
              href="https://katalon.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary inline-flex items-center space-x-2"
            >
              <ExternalLink size={16} />
              <span>Learn More About Katalon</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
