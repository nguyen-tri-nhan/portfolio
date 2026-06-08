import { Github, Lock } from 'lucide-react'

interface Project {
  id: string
  title: string
  description: string
  longDescription: string
  technologies: string[]
  liveUrl?: string
  githubUrl?: string
  image?: string
}

const projects: Project[] = [
  {
    id: 'family-tree',
    title: 'Family Tree',
    description: 'Local-first Vietnamese family tree manager — runs as a web app and desktop app (Windows/macOS) from the same codebase',
    longDescription: 'Supports multi-generation, multi-branch trees with automatic kinship labeling dialect-aware for Northern/Southern Vietnamese (Bố/Mẹ vs Ba/Má, Uncle/Aunt/Cousin…). Built with a Storage Adapter Pattern so the same React app runs on both web (file input + localStorage) and Electron (native file dialog, IPC, atomic writes). Kinship computed via Lowest Common Ancestor algorithm. Supports lunar/solar calendar and PNG/PDF export. Desktop builds (.dmg/.exe) published via GitHub Actions; web deployed on Vercel.',
    technologies: ['React', 'TypeScript', 'Electron', 'Vite', 'Vitest', 'GitHub Actions', 'Vercel'],
    liveUrl: 'https://project-miqs8.vercel.app',
    githubUrl: 'https://github.com/nguyen-tri-nhan/family-tree',
  },
  {
    id: 'ai-authoring-agent',
    title: 'AI Authoring Agent & Test Runner',
    description: 'AI-powered multi-agent system for automated test-case generation and browser automation orchestration',
    longDescription: 'Built asynchronous AI-driven browser automation runners using Playwright MCP and Chrome DevTools Protocol. Integrated Jira, Azure DevOps, PDFs, and spreadsheets into context-ingestion pipelines for AI-based test generation.',
    technologies: ['Python', 'Google ADK', 'LiteLLM', 'A2A Protocol', 'Playwright MCP', 'CDP', 'Docker'],
    image: 'https://2465122.fs1.hubspotusercontent-na1.net/hub/2465122/hubfs/g_fNa7d1_400x400%20(1).jpg?width=108&height=108',
  },
  {
    id: 'katalon-authoring',
    title: 'Katalon Authoring',
    description: 'ReactJS micro-frontend applications and backend orchestration services for browser-based testing workflows',
    longDescription: 'Led backend delivery in a cross-functional squad. Developed Kotlin/Quarkus/Kafka services and maintained a shared micro-frontend library adopted across 5+ teams and 7+ applications.',
    technologies: ['Kotlin', 'Quarkus', 'Kafka', 'React', 'TypeScript', 'AWS', 'ArgoCD'],
    image: 'https://2465122.fs1.hubspotusercontent-na1.net/hub/2465122/hubfs/g_fNa7d1_400x400%20(1).jpg?width=108&height=108',
  },
  {
    id: 'katalon-truetest',
    title: 'Katalon TrueTest',
    description: 'AI-assisted autonomous testing platform with browser traffic collection and session recording',
    longDescription: 'Architected a micro-frontend platform adopted across 5+ engineering teams. Implemented browser traffic collection modules to generate automation scripts from real user behaviors.',
    technologies: ['React', 'TypeScript', 'Java', 'Quarkus', 'Kafka', 'Python', 'GitHub Actions'],
    image: 'https://2465122.fs1.hubspotusercontent-na1.net/hub/2465122/hubfs/g_fNa7d1_400x400%20(1).jpg?width=108&height=108',
  },
  {
    id: 'visual-testing-engine',
    title: 'Visual Testing Engine',
    description: 'Image-processing engine to detect abnormal UI changes in customer applications',
    longDescription: 'Implemented image capture and pixel-diff comparison pipelines using Python and Java integrated into the Katalon TestOps reporting dashboard.',
    technologies: ['Python', 'Java', 'Spring Boot', 'React'],
    image: 'https://2465122.fs1.hubspotusercontent-na1.net/hub/2465122/hubfs/g_fNa7d1_400x400%20(1).jpg?width=108&height=108',
  },
  {
    id: 'mini-social-network',
    title: 'Mini Social Network',
    description: 'Over-engineered microservices social network built to explore distributed systems patterns end-to-end',
    longDescription: 'Deliberately over-engineered to learn how technologies wire together in practice. Implemented event-driven architecture via Kafka, Debezium CDC, and the Outbox Pattern across 6 independent Quarkus/Kotlin services. Added realtime WebSocket pub/sub for live comments and notifications backed by Redis. Deployed on local Kubernetes with Traefik API gateway and a full LGTM observability stack. Migrated the original codebase from Spring Boot to Quarkus.',
    technologies: ['Kotlin', 'Quarkus', 'Kafka', 'Debezium', 'Redis', 'WebSocket', 'Kubernetes', 'Traefik', 'React', 'OpenTelemetry', 'Grafana'],
    githubUrl: 'https://github.com/nguyen-tri-nhan/mini-social-network',
  },
  {
    id: 'kafdrop',
    title: 'Kafdrop — Open Source',
    description: 'Open source Kafka Web UI for viewing Kafka topics and browsing consumer groups',
    longDescription: 'Added Kafka message publishing and environment-aware debugging capabilities to support internal operational workflows.',
    technologies: ['Java', 'Spring Boot', 'Kafka', 'JavaScript', 'Docker'],
    liveUrl: 'https://github.com/obsidiandynamics/kafdrop',
    githubUrl: 'https://github.com/obsidiandynamics/kafdrop',
    image: 'https://raw.githubusercontent.com/wiki/obsidiandynamics/kafdrop/images/kafdrop-logo.png'
  },
  {
    id: 'portfolio',
    title: 'Interactive Portfolio',
    description: 'Modern portfolio website with terminal animations and interactive features',
    longDescription: 'Built with React, TypeScript, and Tailwind CSS featuring terminal UI and smooth animations.',
    technologies: ['React', 'TypeScript', 'Tailwind CSS', 'Vite'],
    liveUrl: '/',
    githubUrl: 'https://github.com/nguyen-tri-nhan/portfolio',
  }
]

export default function Projects() {
  return (
    <section id="projects" className="py-20 px-4 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Featured <span className="text-primary">Projects</span>
          </h2>
          <p className="text-xl text-slate-600 dark:text-gray-300 max-w-2xl mx-auto">
            A showcase of my best work demonstrating technical skills and problem-solving abilities
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project) => (
            <div key={project.id} className="project-card group">
              <div className="aspect-video bg-slate-100 dark:bg-gray-800 rounded-lg mb-4 overflow-hidden">
                {project.image ? (
                  <div className="w-full h-full bg-white flex items-center justify-center p-4">
                    <img
                      src={project.image}
                      alt={project.title}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center">
                    <span className="text-2xl font-mono">{project.title.split(' ').map(word => word[0]).join('')}</span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {(project.liveUrl || project.githubUrl) ? (
                    <a
                      href={project.liveUrl ?? project.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xl font-bold text-primary hover:underline"
                    >
                      {project.title}
                    </a>
                  ) : (
                    <h3 className="text-xl font-bold text-primary">{project.title}</h3>
                  )}
                  {project.githubUrl ? (
                    <a
                      href={project.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-primary transition-colors"
                      title="View Source Code"
                    >
                      <Github size={18} />
                    </a>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-gray-500 border border-slate-200 dark:border-gray-700 rounded-full px-2 py-0.5">
                      <Lock size={11} />
                      Private
                    </span>
                  )}
                </div>
                <p className="text-slate-700 dark:text-gray-300">{project.description}</p>
                <p className="text-sm text-slate-600 dark:text-gray-400">{project.longDescription}</p>

                <div className="flex flex-wrap gap-2">
                  {project.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full border border-primary/20 transition-shadow hover:shadow-[0_0_8px_rgba(0,255,136,0.5)]"
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
            href="https://github.com/nguyen-tri-nhan"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary inline-flex items-center space-x-2"
          >
            <Github size={20} />
            <span>View All Projects</span>
          </a>
        </div>
      </div>
    </section>
  )
}
