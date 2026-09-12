import { CheckCircle2, FileArchive, Gitlab, Terminal } from "lucide-react";

export function GitLabPage() {
  return (
    <section className="page gitlab-page">
      <div className="page-heading"><div><h2>GitLab CI/CD</h2><p>Publiez output.xml comme artifact pour le recuperer apres le pipeline.</p></div></div>
      <div className="gitlab-steps">
        <article><Gitlab size={22} /><span>1</span><h3>Executer les tests</h3><p>Robot Framework produit le rapport XML dans le job.</p></article>
        <article><FileArchive size={22} /><span>2</span><h3>Conserver l'artifact</h3><p>Ajoutez output.xml et les screenshots aux artifacts.</p></article>
        <article><CheckCircle2 size={22} /><span>3</span><h3>Analyser localement</h3><p>Telechargez l'artifact puis importez son dossier dans Analyse.</p></article>
      </div>
      <article className="pipeline-code">
        <div><Terminal size={18} /><h3>Exemple .gitlab-ci.yml</h3></div>
        <pre><code>{`robot_tests:
  image: python:3.12
  script:
    - pip install robotframework
    - robot --output output.xml tests/
  artifacts:
    when: always
    paths:
      - output.xml
      - screenshots/
    expire_in: 7 days`}</code></pre>
      </article>
    </section>
  );
}
