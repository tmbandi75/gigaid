import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileJson, FileCode, Loader2 } from "lucide-react";

interface DownloadFile {
  id: string;
  name: string;
  description: string;
  type: string;
  size: string;
  path: string;
}

export default function Downloads() {
  const { data, isLoading } = useQuery<{ files: DownloadFile[] }>({
    queryKey: ["/api/downloads"],
  });

  const handleDownload = (file: DownloadFile) => {
    const link = document.createElement("a");
    link.href = file.path;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "json":
        return <FileJson className="h-8 w-8 text-yellow-500" />;
      case "dot":
        return <FileCode className="h-8 w-8 text-blue-500" />;
      default:
        return <FileCode className="h-8 w-8 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-downloads-title">
          Downloads
        </h1>
        <p className="text-muted-foreground mt-2">
          Download GigAid project files including architecture diagrams and configuration files.
        </p>
      </div>

      <div className="grid gap-4">
        {data?.files.map((file) => (
          <Card key={file.id} className="hover-elevate" data-testid={`card-download-${file.id}`}>
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              {getFileIcon(file.type)}
              <div className="flex-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  {file.name}
                  <Badge variant="secondary" className="text-xs">
                    {file.type.toUpperCase()}
                  </Badge>
                </CardTitle>
                <CardDescription>{file.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between pt-0">
              <span className="text-sm text-muted-foreground">{file.size}</span>
              <Button
                onClick={() => handleDownload(file)}
                size="sm"
                data-testid={`button-download-${file.id}`}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h2 className="font-semibold mb-2">About these files</h2>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>
            <strong>DOT files</strong> can be visualized using Graphviz or online tools like{" "}
            <a
              href="https://dreampuf.github.io/GraphvizOnline/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Graphviz Online
            </a>
          </li>
          <li>
            <strong>JSON files</strong> contain structured data about the project configuration and data models
          </li>
        </ul>
      </div>
    </div>
  );
}
