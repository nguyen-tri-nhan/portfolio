import { Github, Linkedin } from 'lucide-react'

export default function Contact() {

  return (
    <section id="contact" className="py-20 px-4 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Connect <span className="text-primary">With Me</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Feel free to connect with me on GitHub and LinkedIn to see my work and professional background.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div>
            <h3 className="text-2xl font-bold mb-6 text-center">Connect With Me</h3>
            
            <div className="space-y-4">
              <a
                href="https://github.com/nguyen-tri-nhan"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-3 p-4 border border-gray-700 rounded-lg hover:border-primary/50 transition-colors group"
              >
                <Github size={24} className="text-primary" />
                <div>
                  <div className="font-semibold">GitHub</div>
                  <div className="text-sm text-gray-400">@nguyen-tri-nhan</div>
                </div>
              </a>
              
              <a
                href="https://www.linkedin.com/in/nguyen-tri-nhan/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-3 p-4 border border-gray-700 rounded-lg hover:border-primary/50 transition-colors group"
              >
                <Linkedin size={24} className="text-blue-500" />
                <div>
                  <div className="font-semibold">LinkedIn</div>
                  <div className="text-sm text-gray-400">/in/nguyen-tri-nhan</div>
                </div>
              </a>
            </div>
            
            <div className="mt-8 text-center text-gray-400">
              <p>Currently not available for new opportunities</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}