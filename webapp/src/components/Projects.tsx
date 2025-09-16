import { ExternalLink, Github, Star, GitFork } from 'lucide-react'

interface Project {
  id: string
  title: string
  description: string
  longDescription: string
  technologies: string[]
  liveUrl?: string
  githubUrl: string
  stars: number
  forks: number
  image: string
}

const projects: Project[] = [
  {
    id: 'kafdrop',
    title: 'Kafdrop',
    description: 'Open source Kafka Web UI for viewing Kafka topics and browsing consumer groups',
    longDescription: 'Contributing to popular Apache Kafka management tool with enhanced UI features.',
    technologies: ['Java', 'Spring Boot', 'Kafka', 'JavaScript', 'Docker'],
    liveUrl: 'https://github.com/obsidiandynamics/kafdrop',
    githubUrl: 'https://github.com/obsidiandynamics/kafdrop',
    stars: 5200,
    forks: 900,
    image: '/kafdrop.jpg'
  },
  {
    id: 'portfolio',
    title: 'Interactive Portfolio',
    description: 'Modern portfolio website with terminal animations and interactive features',
    longDescription: 'Built with React, TypeScript, and Tailwind CSS featuring terminal UI and smooth animations.',
    technologies: ['React', 'TypeScript', 'Tailwind CSS', 'Vite', 'Framer Motion'],
    liveUrl: 'https://nguyen-tri-nhan.dev',
    githubUrl: 'https://github.com/nguyen-tri-nhan/portfolio',
    stars: 12,
    forks: 3,
    image: '/portfolio.jpg'
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
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            A showcase of my best work demonstrating technical skills and problem-solving abilities
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project) => (
            <div key={project.id} className="project-card group">
              <div className="aspect-video bg-gray-800 rounded-lg mb-4 overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center">
                  <span className="text-2xl font-mono">{project.title.split(' ').map(word => word[0]).join('')}</span>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-bold text-primary">{project.title}</h3>
                <p className="text-gray-300">{project.description}</p>
                <p className="text-sm text-gray-400">{project.longDescription}</p>

                <div className="flex flex-wrap gap-2">
                  {project.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full border border-primary/20"
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Star size={16} />
                      <span>{project.stars}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <GitFork size={16} />
                      <span>{project.forks}</span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    {project.liveUrl && (
                      <a
                        href={project.liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-primary text-black rounded-lg hover:bg-primary/90 transition-colors"
                        title="View Live Demo"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                    <a
                      href={project.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors"
                      title="View Source Code"
                    >
                      <Github size={16} />
                    </a>
                  </div>
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