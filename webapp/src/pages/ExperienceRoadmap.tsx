import { ChevronRight, Map } from 'lucide-react'
import { experiences } from '../data/experience'

export default function ExperienceRoadmap() {
  return (
    <section id="roadmap" className="py-20 px-4 relative z-10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold">
            <Map size={16} />
            Experience Roadmap
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mt-6 mb-4">
            From first features to agent platforms
          </h1>
          <p className="text-xl text-slate-600 dark:text-gray-300 max-w-2xl mx-auto">
            A detailed timeline of my growth across Katalon products, focused on backend systems,
            microservices, and AI-driven testing workflows.
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-4 top-0 h-full w-px bg-gradient-to-b from-primary via-primary/40 to-transparent"></div>
          <div className="space-y-10">
            {experiences.map((exp, index) => (
              <div key={`${exp.title}-${exp.period}`} className="relative pl-12">
                <div className="absolute left-1.5 top-6 h-4 w-4 rounded-full bg-primary shadow-[0_0_0_6px_rgba(16,185,129,0.15)]"></div>
                <div className="project-card">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold text-primary">{exp.period}</span>
                    <span className="text-sm text-slate-500 dark:text-gray-400">Phase {experiences.length - index}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-gray-200 mt-2">
                    {exp.title}
                  </h2>

                  <div className="mt-6 space-y-6">
                    {exp.projects.map((project) => (
                      <div key={project.name}>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200">
                          {project.name}
                        </h3>
                        <ul className="mt-3 space-y-2">
                          {project.responsibilities.map((responsibility, respIndex) => (
                            <li key={respIndex} className="flex items-start gap-2 text-slate-700 dark:text-gray-300">
                              <ChevronRight size={16} className="text-primary mt-0.5 flex-shrink-0" />
                              <span className="text-sm leading-relaxed">{responsibility}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-6">
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
        </div>
      </div>
    </section>
  )
}
