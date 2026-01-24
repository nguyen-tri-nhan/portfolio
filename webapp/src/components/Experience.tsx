import { ExternalLink, Calendar, ChevronRight } from 'lucide-react'
import { experiences } from '../data/experience'

export default function Experience() {
  return (
    <section id="experience" className="py-20 px-4 relative z-10 bg-slate-100/70 dark:bg-darker/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Professional <span className="text-primary">Experience</span>
          </h2>
          <p className="text-xl text-slate-600 dark:text-gray-300 max-w-2xl mx-auto">
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
                    className="text-slate-500 dark:text-gray-400 hover:text-primary transition-colors"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
                <p className="text-slate-500 dark:text-gray-400">2021 - Present</p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {experiences.map((exp, index) => (
              <div key={index} className="project-card">
                <div className="flex items-center space-x-3 mb-4">
                  <Calendar size={20} className="text-primary" />
                  <h4 className="text-xl font-bold text-primary">{exp.title}</h4>
                  <span className="text-slate-500 dark:text-gray-400">({exp.period})</span>
                </div>
                
                <div className="space-y-6">
                  {exp.projects.map((project, projectIndex) => (
                    <div key={projectIndex}>
                      <h5 className="font-semibold text-slate-800 dark:text-gray-200 mb-3">{project.name}</h5>
                      <ul className="space-y-2">
                        {project.responsibilities.map((responsibility, respIndex) => (
                          <li key={respIndex} className="flex items-start space-x-2 text-slate-700 dark:text-gray-300">
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
